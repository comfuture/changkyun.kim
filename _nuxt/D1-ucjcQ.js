import{_ as c}from"./C-Zyynjc.js";import{u as i,q as m}from"./B9NA5fhz.js";import{e as _,c as s,a as r,F as f,E as g,g as p,o as n,b as d,w as x,d as y,t as w}from"./C5C27nRP.js";const C=_({__name:"index",setup(b){const{data:l}=i("tags",async()=>{const o=await m("blog").select("tags").all();let t=new Set([]);for(const a of o)if(a.tags)for(const u of a.tags)t.add(u);let e=Array.from(t);return e.sort(),e});return(o,t)=>{const e=c;return n(),s("main",null,[t[0]||(t[0]=r("h2",null,"tags",-1)),r("ul",null,[(n(!0),s(f,null,g(p(l),a=>(n(),s("li",null,[d(e,{to:{name:"blog-tag-tag",params:{tag:a}}},{default:x(()=>[y(w(a),1)]),_:2},1032,["to"])]))),256))])])}}});export{C as default};
