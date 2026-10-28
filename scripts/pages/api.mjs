import { REPOSITORY } from "./policy.mjs";
export class GitHub {
  constructor(token=process.env.GH_TOKEN){if(!token)throw Error("Missing GitHub token");this.token=token;}
  async request(path, options={}) {
    const response=await fetch(`https://api.github.com/repos/${REPOSITORY}/${path}`,{...options,headers:{Authorization:`Bearer ${this.token}`,Accept:"application/vnd.github+json","X-GitHub-Api-Version":"2022-11-28",...options.headers},signal:AbortSignal.timeout(30000)});
    if(response.status===404)return null;
    if(!response.ok)throw Error(`GitHub API ${response.status}: ${path.split('?')[0]}`);
    return response.status===204?null:response.json();
  }
  async pages(path,key) {
    const result=[];for(let page=1;page<=50;page++) {const data=await this.request(`${path}${path.includes('?')?'&':'?'}per_page=100&page=${page}`);const items=key?data?.[key]:data;if(!Array.isArray(items))throw Error("Invalid paginated API response");result.push(...items);if(items.length<100)return result;}
    throw Error("GitHub pagination exceeds safety bound");
  }
  async artifact(run) {
    const artifacts=await this.pages(`actions/runs/${run}/artifacts`,"artifacts");
    const matches=artifacts.filter(a=>a.name==="pages-site"&&!a.expired&&a.workflow_run?.id===run);
    if(matches.length!==1)throw Error("Expected one current site artifact");return matches[0];
  }
  async zip(id) {
    const response=await fetch(`https://api.github.com/repos/${REPOSITORY}/actions/artifacts/${id}/zip`,{headers:{Authorization:`Bearer ${this.token}`},signal:AbortSignal.timeout(30000)});
    if(!response.ok)throw Error("Site artifact download failed");
    const reader=response.body.getReader(),parts=[];let size=0;
    for(;;){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>33554432){await reader.cancel();throw Error("Artifact archive too large");}parts.push(value);}
    return Buffer.concat(parts);
  }
}
