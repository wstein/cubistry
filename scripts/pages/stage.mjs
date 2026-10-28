import{writeFile,mkdir,appendFile}from"node:fs/promises";import{execFileSync}from"node:child_process";
import{GitHub}from"./api.mjs";import{REPOSITORY,validRun,previewPath}from"./policy.mjs";
const entry=JSON.parse(process.env.ENTRY),api=new GitHub();
let action="none";
if(entry.number===0){
  if(entry.status==="success"){
    const main=await api.request("commits/main"),run=await api.request(`actions/runs/${entry.run}`);
    if(main.sha===entry.sha&&validRun(run,entry.sha,["push","workflow_dispatch"])&&run.head_branch==="main"&&run.status==="completed"&&run.conclusion==="success")action="deploy";
  }
  if(action!=="deploy"){
    const existing=await api.request("contents/index.html?ref=gh-pages");
    if(existing?.type!=="file")throw Error("Refusing initial publication without a verified production baseline");
  }
}else{
  previewPath(entry.number);const pr=await api.request(`pulls/${entry.number}`);
  if(entry.action==="remove"){
    if(!pr||pr.state!=="open"||pr.head?.repo?.full_name!==REPOSITORY)action="remove";
  }else if(entry.action==="deploy"&&pr?.state==="open"&&pr.head?.repo?.full_name===REPOSITORY&&pr.head.sha===entry.sha){
    const run=await api.request(`actions/runs/${entry.run}`);
    if(validRun(run,pr.head.sha,"pull_request")&&run.status==="completed"&&run.conclusion==="success")action="deploy";
  }
}
if(action==="deploy"){
  const artifact=await api.artifact(entry.run);if(artifact.size_in_bytes>33554432)throw Error("Site artifact exceeds budget");
  await writeFile("site.zip",await api.zip(artifact.id));
  execFileSync("python3",["scripts/pages/extract.py","site.zip","artifact-site",String(entry.number),entry.sha],{stdio:"inherit"});
  if(entry.number)await writeFile("artifact-site/preview-info.json",JSON.stringify({number:entry.number,sha:entry.sha,run:entry.run}));
}
await appendFile(process.env.GITHUB_OUTPUT,`action=${action}\n`);
