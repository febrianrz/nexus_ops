(()=>{var a={};a.id=461,a.ids=[461],a.modules={261:a=>{"use strict";a.exports=require("next/dist/shared/lib/router/utils/app-paths")},3421:(a,b,c)=>{"use strict";Object.defineProperty(b,"I",{enumerable:!0,get:function(){return g}});let d=c(71237),e=c(55088),f=c(17679);async function g(a,b,c,g){if((0,d.isNodeNextResponse)(b)){var h;b.statusCode=c.status,b.statusMessage=c.statusText;let d=["set-cookie","www-authenticate","proxy-authenticate","vary"];null==(h=c.headers)||h.forEach((a,c)=>{if("x-middleware-set-cookie"!==c.toLowerCase())if("set-cookie"===c.toLowerCase())for(let d of(0,f.splitCookiesString)(a))b.appendHeader(c,d);else{let e=void 0!==b.getHeader(c);(d.includes(c.toLowerCase())||!e)&&b.appendHeader(c,a)}});let{originalResponse:i}=b;c.body&&"HEAD"!==a.method?await (0,e.pipeToNodeResponse)(c.body,i,g):i.end()}}},10846:a=>{"use strict";a.exports=require("next/dist/compiled/next-server/app-page.runtime.prod.js")},29294:a=>{"use strict";a.exports=require("next/dist/server/app-render/work-async-storage.external.js")},33873:a=>{"use strict";a.exports=require("path")},44870:a=>{"use strict";a.exports=require("next/dist/compiled/next-server/app-route.runtime.prod.js")},55511:a=>{"use strict";a.exports=require("crypto")},63033:a=>{"use strict";a.exports=require("next/dist/server/app-render/work-unit-async-storage.external.js")},78335:()=>{},86e3:(a,b,c)=>{"use strict";c.r(b),c.d(b,{handler:()=>J,patchFetch:()=>I,routeModule:()=>E,serverHooks:()=>H,workAsyncStorage:()=>F,workUnitAsyncStorage:()=>G});var d={};c.r(d),c.d(d,{GET:()=>D});var e=c(95736),f=c(9117),g=c(4044),h=c(39326),i=c(32324),j=c(261),k=c(54290),l=c(85328),m=c(38928),n=c(46595),o=c(3421),p=c(17679),q=c(41681),r=c(63446),s=c(86439),t=c(34679),u=c(51356);let v=a=>a.replace(/</g,"\\u003c").replace(/>/g,"\\u003e").replace(/&/g,"\\u0026").replace(/\u2028/g,"\\u2028").replace(/\u2029/g,"\\u2029"),w=a=>v(JSON.stringify(a)),x=a=>a.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;"),y=a=>x(a).replace(/"/g,"&quot;"),z=a=>a?` nonce="${y(a)}"`:"",A=a=>`[${a.map(a=>"function"==typeof a?a.toString():v(JSON.stringify(a)??"undefined")).join(", ")}]`;var B=`
/* basic theme */
.dark-mode {
  --scalar-color-1: rgba(255, 255, 255, 0.9);
  --scalar-color-2: rgba(255, 255, 255, 0.62);
  --scalar-color-3: rgba(255, 255, 255, 0.44);
  --scalar-color-accent: #3070ec;

  --scalar-background-1: #000000;
  --scalar-background-2: #1a1a1a;
  --scalar-background-3: #2a2828;
  --scalar-background-accent: transparent;

  --scalar-border-color: rgba(255, 255, 255, 0.1);
}

.light-mode .dark-mode,
.light-mode {
  --scalar-color-1: #1b1b1b;
  --scalar-color-2: #707070;
  --scalar-color-3: #8e8e8e;
  --scalar-color-accent: #3070ec;

  --scalar-background-1: #fff;
  --scalar-background-2: #fafafa;
  --scalar-background-3: #e7e7e7;
  --scalar-background-accent: transparent;

  --scalar-border-color: rgba(0, 0, 0, 0.1);
}
.light-mode .scalar-card {
  --scalar-background-1: #fff;
  --scalar-background-2: #fff !important;
  --scalar-background-3: #fff !important;
}
.dark-mode .scalar-card {
  --scalar-background-1: #000000;
  --scalar-background-2: #000000 !important;
  --scalar-background-3: #000000 !important;
}
.light-mode .examples .scalar-card .scalar-card-header {
  --scalar-background-2: #fafafa;
}
.dark-mode .examples .scalar-card .scalar-card-header {
  --scalar-background-2: #1a1a1a;
  --scalar-border-color: #1a1a1a;
}
/* Document header */
.light-mode .t-doc__header,
.dark-mode .t-doc__header {
  --scalar-header-background-1: rgba(255,255,255,.8);
  --scalar-header-border-color: var(--scalar-border-color);
  --scalar-header-color-1: var(--scalar-color-1);
  --scalar-header-color-2: var(--scalar-color-2);
  --scalar-header-background-toggle: var(--scalar-color-3);
  --scalar-header-call-to-action-color: var(--scalar-color-accent);
  backdrop-filter: saturate(180%) blur(5px);
}

.dark-mode .t-doc__header {
  --scalar-header-background-1: rgba(0,0,0,.5);
}
/* Document Sidebar */
.light-mode .t-doc__sidebar,
.dark-mode .t-doc__sidebar {
  --scalar-sidebar-background-1: var(--scalar-background-1);
  --scalar-sidebar-item-hover-color: var(--scalar-sidebar-color-1);
  --scalar-sidebar-item-hover-background: transparent;
  --scalar-sidebar-item-active-background: var(--scalar-background-accent);
  --scalar-sidebar-border-color: transparent;
  --scalar-sidebar-color-1: var(--scalar-color-1);
  --scalar-sidebar-color-2: var(--scalar-color-2);
  --scalar-sidebar-color-active: var(--scalar-color-accent);
  --scalar-sidebar-search-background: var(--scalar-background-2);
  --scalar-sidebar-search-border-color: var(--scalar-background-2);
  --scalar-sidebar-search-color: var(--scalar-color-3);
  --scalar-sidebar-indent-border: var(--scalar-border-color);
  --scalar-sidebar-indent-border-active: #6aacf8;
}
.api-client-drawer .t-doc__sidebar {
  --scalar-sidebar-border-color: var(--scalar-border-color);
}
/* advanced */
.light-mode .dark-mode,
.light-mode {
  --scalar-button-1: rgb(49 53 56);
  --scalar-button-1-color: #fff;
  --scalar-button-1-hover: rgb(28 31 33);

  --scalar-color-green: #417942;
  --scalar-color-red: #ae3763;
  --scalar-color-yellow: #edbe20;
  --scalar-color-blue: #2b66cf;
  --scalar-color-orange: #cf7a2b;
  --scalar-color-purple: #6e27b5;

  --scalar-scrollbar-color: rgba(0, 0, 0, 0.18);
  --scalar-scrollbar-color-active: rgba(0, 0, 0, 0.36);
}
.dark-mode {
  --scalar-button-1: #f6f6f6;
  --scalar-button-1-color: #000;
  --scalar-button-1-hover: #e7e7e7;

  --scalar-color-green: #7abe7b;
  --scalar-color-red: #e5698f;
  --scalar-color-yellow: #f8ea68;
  --scalar-color-blue: #68a6f8;
  --scalar-color-orange: #f89c68;
  --scalar-color-purple: #b57de9;

  --scalar-scrollbar-color: rgba(255, 255, 255, 0.24);
  --scalar-scrollbar-color-active: rgba(255, 255, 255, 0.48);
}
.sidebar .sidebar-indent-nested .sidebar-heading {
  padding-right: 0;
}
.sidebar-search-key {
  background: var(--scalar-background-1) !important;
  border: 1px solid var(--scalar-border-color);
}
`,C=(a,b)=>{let{cdn:c,pageTitle:d,nonce:e,...f}={_integration:"nextjs",...a},g=new Headers(b.headers);return g.set("Content-Type","text/html; charset=utf-8"),new Response(function(a,b=""){let{config:c,pageTitle:d,cdn:e,nonce:f}=a,g=x(d??"Scalar API Reference"),{customCss:h,theme:i,bundle:j,...k}=(Array.isArray(c)?c[0]:c)??{},l=a.bundle??j,m=(a=>{let b={...a};return"function"==typeof b.content&&(b.content=b.content()),b.content&&b.url&&delete b.content,b})({...k,...i?{theme:i}:{},...void 0!==h?{customCss:h}:{}}),n=f?`
    <meta property="csp-nonce" content="${y(f)}" />`:"";return`<!doctype html>
<html>
  <head>
    <title>${g}</title>
    <meta charset="utf-8" />
    <meta
      name="viewport"
      content="width=device-width, initial-scale=1" />${n}${((a,b,c)=>{let d=[];return(a.customCss&&(d.push("/* Custom CSS */"),d.push(a.customCss)),!a.theme&&b&&(d.push("/* Custom Theme */"),d.push(b)),0===d.length)?"":`
    <style type="text/css"${z(c)}>
      ${((a,b=2,c=!1)=>{let d=" ".repeat(b);return a.split("\n").map((a,b)=>0!==b||c?`${d}${a}`:a).join("\n")})(d.join("\n\n"),6)}
    </style>`})(m,b,f)}
  </head>
  <body>
    <div id="app"></div>${function(a,b,c,d){let e=function(a){let b={...a},c=[];for(let[d,e]of Object.entries(a))"function"==typeof e?(c.push(`${w(d)}: ${e.toString()}`),delete b[d]):Array.isArray(e)&&e.some(a=>"function"==typeof a)&&(c.push(`${w(d)}: ${A(e)}`),delete b[d]);let d=v(JSON.stringify(b,null,2)),e=d.split("\n").map((a,b)=>0===b?a:`      ${a}`).join("\n");if(0===c.length)return e;if("{}"===d)return`{
        ${c.join(",\n        ")}
      }`;let f=e.split("\n").slice(0,-1).join("\n");return`${f},
        ${c.join(",\n        ")}
      }`}(a),f=z(c);return!1===d||void 0===d&&(void 0!==b||c)?`
    <!-- Load the Script -->
    <script src="${b??"https://cdn.jsdelivr.net/npm/@scalar/api-reference"}"${f}></script>

    <!-- Initialize the Scalar API Reference -->
    <script type="text/javascript"${f}>
      Scalar.createApiReference('#app', ${e})
    </script>`:`
    <!-- Load the Scalar API Reference -->
    <script type="module"${f}>
      import { createApiReference } from '${"string"==typeof d?d:"https://cdn.jsdelivr.net/npm/@scalar/api-reference/esm.js"}'

      createApiReference('#app', ${e})
    </script>`}(m,e,f,l)}
  </body>
</html>`}({config:f,pageTitle:d,cdn:c,nonce:e},B),{headers:g})};let D=function(a,b={}){if("function"==typeof a)return async c=>C(await a(c),b);let c={...a};return()=>C(c,b)}({pageTitle:"NexusOps API Reference",theme:"purple",hideModels:!1,spec:{url:"/api/openapi"}}),E=new e.AppRouteRouteModule({definition:{kind:f.RouteKind.APP_ROUTE,page:"/developer/docs/route",pathname:"/developer/docs",filename:"route",bundlePath:"app/developer/docs/route"},distDir:".next-docker-check",relativeProjectDir:"",resolvedPagePath:"/Users/febrianreza/Project/Alter/next_taskmn/app/developer/docs/route.ts",nextConfigOutput:"standalone",userland:d}),{workAsyncStorage:F,workUnitAsyncStorage:G,serverHooks:H}=E;function I(){return(0,g.patchFetch)({workAsyncStorage:F,workUnitAsyncStorage:G})}async function J(a,b,c){var d;let e="/developer/docs/route";"/index"===e&&(e="/");let g=await E.prepare(a,b,{srcPage:e,multiZoneDraftMode:!1});if(!g)return b.statusCode=400,b.end("Bad Request"),null==c.waitUntil||c.waitUntil.call(c,Promise.resolve()),null;let{buildId:v,params:w,nextConfig:x,isDraftMode:y,prerenderManifest:z,routerServerContext:A,isOnDemandRevalidate:B,revalidateOnlyGenerated:C,resolvedPathname:D}=g,F=(0,j.normalizeAppPath)(e),G=!!z.routes[D]&&(E.isDev||(0,t.isRouteCacheOwner)(D,E.cacheOwner,z.routes[D])),H=!!(z.dynamicRoutes[F]||G);if(H&&!y){let a=z.dynamicRoutes[F];if(a&&!1===a.fallback&&!G)throw new s.NoFallbackError}let I=null;!H||E.isDev||y||(I="/index"===(I=D)?"/":I);let J=!0===E.isDev||!H,K=H&&!J,L=a.method||"GET",M=(0,i.getTracer)(),N=M.getActiveScopeSpan(),O={params:w,prerenderManifest:z,renderOpts:{experimental:{cacheComponents:!!x.experimental.cacheComponents,authInterrupts:!!x.experimental.authInterrupts},supportsDynamicResponse:J,incrementalCache:(0,h.getRequestMeta)(a,"incrementalCache"),cacheLifeProfiles:null==(d=x.experimental)?void 0:d.cacheLife,isRevalidate:K,waitUntil:c.waitUntil,onClose:a=>{b.on("close",a)},onAfterTaskError:void 0,onInstrumentationRequestError:(b,c,d)=>E.onRequestError(a,b,d,A)},sharedContext:{buildId:v}},P=new k.NodeNextRequest(a),Q=new k.NodeNextResponse(b),R=l.NextRequestAdapter.fromNodeNextRequest(P,(0,l.signalFromNodeResponse)(b));try{let d=async c=>E.handle(R,O).finally(()=>{if(!c)return;c.setAttributes({"http.status_code":b.statusCode,"next.rsc":!1});let d=M.getRootSpanAttributes();if(!d)return;if(d.get("next.span_type")!==m.BaseServerSpan.handleRequest)return void console.warn(`Unexpected root span type '${d.get("next.span_type")}'. Please report this Next.js issue https://github.com/vercel/next.js`);let e=d.get("next.route");if(e){let a=`${L} ${e}`;c.setAttributes({"next.route":e,"http.route":e,"next.span_name":a}),c.updateName(a)}else c.updateName(`${L} ${a.url}`)}),g=async g=>{var i,j;let k=async({previousCacheEntry:f})=>{try{if(!(0,h.getRequestMeta)(a,"minimalMode")&&B&&C&&!f)return b.statusCode=404,b.setHeader("x-nextjs-cache","REVALIDATED"),b.end("This page could not be found"),null;let e=await d(g);a.fetchMetrics=O.renderOpts.fetchMetrics;let i=O.renderOpts.pendingWaitUntil;i&&c.waitUntil&&(c.waitUntil(i),i=void 0);let j=O.renderOpts.collectedTags;if(!H)return await (0,o.I)(P,Q,e,O.renderOpts.pendingWaitUntil),null;{let a=await e.blob(),b=(0,p.toNodeOutgoingHttpHeaders)(e.headers);j&&(b[r.NEXT_CACHE_TAGS_HEADER]=j),!b["content-type"]&&a.type&&(b["content-type"]=a.type);let c=void 0!==O.renderOpts.collectedRevalidate&&!(O.renderOpts.collectedRevalidate>=r.INFINITE_CACHE)&&O.renderOpts.collectedRevalidate,d=void 0===O.renderOpts.collectedExpire||O.renderOpts.collectedExpire>=r.INFINITE_CACHE?void 0:O.renderOpts.collectedExpire;return{value:{kind:u.CachedRouteKind.APP_ROUTE,status:e.status,body:Buffer.from(await a.arrayBuffer()),headers:b},cacheControl:{revalidate:c,expire:d}}}}catch(b){throw(null==f?void 0:f.isStale)&&await E.onRequestError(a,b,{routerKind:"App Router",routePath:e,routeType:"route",revalidateReason:(0,n.c)({isRevalidate:K,isOnDemandRevalidate:B})},A),b}},l=await E.handleResponse({req:a,nextConfig:x,cacheKey:I,routeKind:f.RouteKind.APP_ROUTE,isFallback:!1,prerenderManifest:z,isRoutePPREnabled:!1,isOnDemandRevalidate:B,revalidateOnlyGenerated:C,responseGenerator:k,waitUntil:c.waitUntil});if(!H)return null;if((null==l||null==(i=l.value)?void 0:i.kind)!==u.CachedRouteKind.APP_ROUTE)throw Object.defineProperty(Error(`Invariant: app-route received invalid cache entry ${null==l||null==(j=l.value)?void 0:j.kind}`),"__NEXT_ERROR_CODE",{value:"E701",enumerable:!1,configurable:!0});(0,h.getRequestMeta)(a,"minimalMode")||b.setHeader("x-nextjs-cache",B?"REVALIDATED":l.isMiss?"MISS":l.isStale?"STALE":"HIT"),y&&b.setHeader("Cache-Control","private, no-cache, no-store, max-age=0, must-revalidate");let m=(0,p.fromNodeOutgoingHttpHeaders)(l.value.headers);return(0,h.getRequestMeta)(a,"minimalMode")&&H||m.delete(r.NEXT_CACHE_TAGS_HEADER),!l.cacheControl||b.getHeader("Cache-Control")||m.get("Cache-Control")||m.set("Cache-Control",(0,q.getCacheControlHeader)(l.cacheControl)),await (0,o.I)(P,Q,new Response(l.value.body,{headers:m,status:l.value.status||200})),null};N?await g(N):await M.withPropagatedContext(a.headers,()=>M.trace(m.BaseServerSpan.handleRequest,{spanName:`${L} ${a.url}`,kind:i.SpanKind.SERVER,attributes:{"http.method":L,"http.target":a.url}},g))}catch(b){if(b instanceof s.NoFallbackError||await E.onRequestError(a,b,{routerKind:"App Router",routePath:F,routeType:"route",revalidateReason:(0,n.c)({isRevalidate:K,isOnDemandRevalidate:B})}),H)throw b;return await (0,o.I)(P,Q,new Response(null,{status:500})),null}}},86439:a=>{"use strict";a.exports=require("next/dist/shared/lib/no-fallback-error.external")},95736:(a,b,c)=>{"use strict";a.exports=c(44870)},96487:()=>{}};var b=require("../../../webpack-runtime.js");b.C(a);var c=b.X(0,[887],()=>b(b.s=86e3));module.exports=c})();