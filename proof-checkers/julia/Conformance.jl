# Included inside IndependentProof: no external move implementation is imported.
function pinned_manifest(root)
    path=joinpath(root,"proof-checkers/conformance/manifest.json")
    need(bytes2hex(sha256(read(path)))==MANIFEST_PIN,"conformance manifest pin";code="CORPUS_ERROR")
    data,_=read_json(path)
    need(data["caseCount"]==195 && data["counterCaseCount"]==41 && data["geometryCaseCount"]==154,"complete conformance counts";code="CORPUS_ERROR")
    need(length(data["cases"])==195 && length(Set((r["group"],r["name"]) for r in data["cases"]))==195,"all named cases";code="CORPUS_ERROR")
    for group in ["counter","geometry"]
        names=Set(r["name"]*".json" for r in data["cases"] if r["group"]==group)
        need(Set(filter(n->endswith(n,".json"),readdir(joinpath(root,"proof-checkers/conformance",group))))==names,"exact fixture filenames";code="CORPUS_ERROR")
    end
    for row in data["cases"]
        path=joinpath(root,row["path"])
        need(bytes2hex(sha256(read(path)))==row["sha256"],"fixture hash "*row["name"];code="CORPUS_ERROR")
    end
    for field in ["counterChain","kernel"]
        row=data[field];need(bytes2hex(sha256(read(joinpath(root,row["path"]))))==row["sha256"],"resource hash "*field;code="CORPUS_ERROR")
    end
    data
end
function pinned_chain(root)
    path=joinpath(root,"proof-checkers/conformance/counter-chain.json")
    need(bytes2hex(sha256(read(path)))==CHAIN_PIN,"counter chain pin";code="CORPUS_ERROR")
    first(read_json(path))
end
function evaluate(command,path,root;include_state=true)
    try
        data,input_sha=read_json(path)
        result=command=="counter" ? check_counter(data,pinned_chain(root)) :
               command=="state3" ? check_state(data;include_state=include_state) : throw(Invalid("UNSUPPORTED","unknown command"))
        result["inputSHA256"]=input_sha;result
    catch error
        invalid_result(error)
    end
end
function conformance(root;export_path=nothing)
    manifest=pinned_manifest(root);chain=pinned_chain(root)
    export_path!==nothing && need(!ispath(export_path),"export path must be new";code="ERROR")
    exports=export_path===nothing ? nothing : open(export_path,"w")
    reports=Any[];hashes=String[]
    try
        for row in manifest["cases"]
            command=row["group"]=="counter" ? "counter" : "state3"
            result=evaluate(command,joinpath(root,row["path"]),root;include_state=exports!==nothing)
            need(result["status"]!="ERROR","unexpected runtime error in "*row["name"]*": "*get(result,"reason","");code="CONFORMANCE_ERROR")
            need(result["valid"]==row["expectedValid"],"case validity "*row["name"];code="CONFORMANCE_ERROR")
            record=Dict{String,Any}("group"=>row["group"],"name"=>row["name"],"valid"=>result["valid"],"status"=>result["status"])
            if result["valid"]
                key=row["group"]=="counter" ? "canonicalStateSHA256" : "stateSHA256"
                expected=row["group"]=="counter" ? row["canonicalStateSHA256"] : row["expectedStateSHA256"]
                need(result[key]==expected,"full state digest "*row["name"];code="CONFORMANCE_ERROR")
                record[key]=result[key];push!(hashes,result[key])
                if haskey(row,"expectedGoalMatches")
                    need(result["goalMatches"]==row["expectedGoalMatches"],"optical goal "*row["name"];code="CONFORMANCE_ERROR")
                    record["goalMatches"]=result["goalMatches"]
                end
                if exports!==nothing
                    if row["group"]=="counter"
                        for (i,state) in enumerate(result["canonicalStates"])
                            println(exports,JSON.json(Dict("group"=>"counter","name"=>row["name"],"value"=>i-1,"state"=>state)))
                        end
                    else
                        println(exports,JSON.json(Dict("group"=>"geometry","name"=>row["name"],"state"=>result["state"])))
                    end
                end
            end
            push!(reports,record)
        end
        kernel,_=read_json(joinpath(root,manifest["kernel"]["path"]))
        need(kernel["schema"]=="cubistry.center-kernel.v1" && length(kernel["rows"])==2048 && length(kernel["generators"])==36,"kernel schema/counts";code="CORPUS_ERROR")
        source=stickers(kernel["printing"],3);source_valid(source,3)
        need(length(Set(row["i"] for row in kernel["rows"]))==2048,"unique kernel indices";code="CORPUS_ERROR")
        for (group,rows) in [("generators",kernel["generators"]),("kernel",kernel["rows"])]
            for (index,row) in enumerate(rows)
                ts=moves(row["word"];whole=true);state=apply_tokens(source,ts)
                result=check_state_parts(source,state,Dict();include_state=false)
                expected=group=="kernel" ? row["o"] : row["delta"]
                need(result["centerTwists"]==expected,"all physical center orientations";code="CONFORMANCE_ERROR")
                need(all(s->count(!=(0),s.p)==1 || s==only(filter(t->t.id==s.id,source)),state),"noncenter identity";code="CONFORMANCE_ERROR")
                need(state_hash(state)==row["expectedStateSHA256"],"all 54 expected kernel frames";code="CONFORMANCE_ERROR")
                need(apply_tokens(state,inverse_tokens(ts))==source,"full kernel inverse";code="CONFORMANCE_ERROR")
                need(length(ts)==row["htm"],"actual reference move count";code="CONFORMANCE_ERROR")
                push!(hashes,result["stateSHA256"])
                if exports!==nothing
                    println(exports,JSON.json(Dict("group"=>group,"name"=>index,"state"=>JSON.parse(state_wire(state)))))
                end
            end
        end
        Dict("valid"=>true,"status"=>"VALID","counterCases"=>41,"counterAccepted"=>2,"counterRejected"=>39,
             "geometryCases"=>154,"geometryAccepted"=>129,"geometryRejected"=>25,"kernelReferences"=>2048,"centerGenerators"=>36,
             "caseReports"=>reports,"fullStateAggregateSHA256"=>bytes2hex(sha256(join(hashes,"\n"))),"manifestSHA256"=>MANIFEST_PIN)
    finally
        exports!==nothing && close(exports)
    end
end
