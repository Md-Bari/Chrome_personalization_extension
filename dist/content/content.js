"use strict";(()=>{var p="data-pm-host",M="data-pm-wrap",A="data-pm-orig",S="privacy_mask_rules_v3",E="\u2588\u2588\u2588\u2588";var c=[],f=!1,h=null,x=null,g=null,s=null,u=new Map;function I(){return new Promise(t=>{try{chrome.storage.local.get([S],e=>{if(chrome.runtime.lastError){t([]);return}let n=e[S];t(Array.isArray(n)?n:[])})}catch{t([])}})}async function tt(t){let e=await I(),n=e.findIndex(o=>o.id===t.id);return n>=0?e[n]=t:e.push(t),new Promise((o,r)=>{chrome.storage.local.set({[S]:e},()=>{chrome.runtime.lastError?r(chrome.runtime.lastError):o()})})}function et(){return I().then(t=>{let e=location.hostname.toLowerCase(),n=location.pathname;return t.filter(o=>{let r=o.hostname.toLowerCase();return r===e||e.endsWith("."+r)||r.endsWith("."+e)?o.matchScope==="page"?o.pathname===n:!0:!1})})}function B(t){return/^(:r|ember|react-aria|uid-|mui-|\d)/.test(t)||/\d{5,}/.test(t)}function O(t){let e=[],n=t;for(;n&&n!==document.body&&n!==document.documentElement;){if(n.id&&!B(n.id)){e.unshift(`#${CSS.escape(n.id)}`);break}let o=n.parentElement;if(!o)break;let r=Array.from(o.children).filter(m=>m.tagName===n.tagName),i=r.indexOf(n)+1;e.unshift(r.length>1?`${n.tagName.toLowerCase()}:nth-of-type(${i})`:n.tagName.toLowerCase()),n=o}return e.join(" > ")}function nt(t){if(t.id&&!B(t.id))return`#${CSS.escape(t.id)}`;for(let e of["data-testid","data-test","data-qa","data-cy"]){let n=t.getAttribute(e);if(n)return`[${e}="${CSS.escape(n)}"]`}return O(t)}function U(t){try{let e=document.querySelector(t.cssSelector);if(e)return e}catch{}if(t.domPath&&t.domPath!==t.cssSelector)try{let e=document.querySelector(t.domPath);if(e)return e}catch{}if(t.originalText&&t.originalText.trim().length>0){let e=t.originalText.trim(),n=document.querySelectorAll("span,p,td,th,div,h1,h2,h3,h4,h5,h6,li,label,strong,b,a,em,code");for(let o of n)if(!o.querySelector("[data-pm-wrap]")&&(o.textContent||"").trim()===e)return o;if(e.length>15){for(let o of n)if(!o.querySelector("[data-pm-wrap]")&&(o.textContent||"").includes(e))return o}}return null}var b=new Map;function ot(t){let e=[],n=document.createTreeWalker(t,NodeFilter.SHOW_TEXT,{acceptNode(r){return r.parentElement?.closest(`[${M}]`)?NodeFilter.FILTER_REJECT:(r.textContent||"").trim()?NodeFilter.FILTER_ACCEPT:NodeFilter.FILTER_SKIP}}),o;for(;o=n.nextNode();)e.push(o);return e}function C(t,e){if(t.getAttribute(p)===e.id)return!0;let n=t.getAttribute(p);n&&X(n),t.setAttribute(p,e.id);let o=ot(t);if(o.length===0)return t.setAttribute("data-pm-block","true"),t.setAttribute("data-pm-masktext",e.maskText||E),!0;for(let r of o){let i=r.textContent??"";if(!i.trim())continue;let m=document.createElement("span");m.className="pm-wrapper",m.setAttribute(M,e.id),m.setAttribute(A,i);let a=document.createElement("span");a.className="pm-text",a.setAttribute("aria-hidden","true"),a.textContent=e.maskText||E;let l=document.createElement("button");l.className="pm-eye",l.type="button",l.title="Reveal temporarily",l.textContent="\u{1F441}",l.addEventListener("click",d=>{d.stopPropagation(),d.preventDefault(),K(e.id,e.maskText||E)}),m.appendChild(a),m.appendChild(l),r.parentNode?.replaceChild(m,r)}return!0}function X(t){document.querySelectorAll(`[${M}="${t}"]`).forEach(n=>{let o=n.getAttribute(A)??"";n.parentNode?.replaceChild(document.createTextNode(o),n)}),document.querySelectorAll(`[${p}="${t}"]`).forEach(n=>{n.removeAttribute(p),n.removeAttribute("data-pm-block"),n.removeAttribute("data-pm-masktext")});let e=b.get(t);e&&(clearTimeout(e),b.delete(t))}function R(){document.querySelectorAll(`[${M}]`).forEach(t=>{t.parentNode?.replaceChild(document.createTextNode(t.getAttribute(A)??""),t)}),document.querySelectorAll(`[${p}]`).forEach(t=>{t.removeAttribute(p),t.removeAttribute("data-pm-block"),t.removeAttribute("data-pm-masktext")}),b.forEach(clearTimeout),b.clear()}function K(t,e,n=5){let o=b.get(t),r=document.querySelectorAll(`[${M}="${t}"]`),i=document.querySelectorAll(`[${p}="${t}"][data-pm-block="true"], [${p}="${t}"][data-pm-revealed="true"]`);if(o){clearTimeout(o),b.delete(t),r.forEach(a=>{let l=a.querySelector(".pm-text");l&&(l.textContent=e,l.removeAttribute("style")),a.removeAttribute("data-pm-revealed")}),i.forEach(a=>{a.setAttribute("data-pm-block","true"),a.removeAttribute("data-pm-revealed")});return}r.forEach(a=>{let l=a.getAttribute(A)??"",d=a.querySelector(".pm-text");d&&(d.textContent=l,d.style.cssText="letter-spacing:normal!important;color:#10b981!important;font-weight:inherit!important;font-family:inherit!important;background:rgba(16,185,129,0.15)!important;padding:0 2px!important;border-radius:2px!important;"),a.setAttribute("data-pm-revealed","true")}),i.forEach(a=>{a.removeAttribute("data-pm-block"),a.setAttribute("data-pm-revealed","true")});let m=setTimeout(()=>{document.querySelectorAll(`[${M}="${t}"]`).forEach(a=>{let l=a.querySelector(".pm-text");l&&(l.textContent=e,l.removeAttribute("style")),a.removeAttribute("data-pm-revealed")}),document.querySelectorAll(`[${p}="${t}"][data-pm-revealed="true"]`).forEach(a=>{a.setAttribute("data-pm-block","true"),a.removeAttribute("data-pm-revealed")}),b.delete(t)},n*1e3);b.set(t,m)}var L=!1;async function k(){if(!L){L=!0;try{c=await et();for(let t of c){if(!t.enabled||document.querySelector(`[${p}="${t.id}"]`))continue;let e=u.get(t.id)??0;if(e>=3)continue;let n=U(t);n?(C(n,t),u.delete(t.id)):(u.set(t.id,e+1),e===0&&console.warn(`[PM] Element not found for rule ${t.id} (selector: "${t.cssSelector}"). Will retry 2 more times.`))}y()}finally{L=!1}}}function rt(){f&&T(),f=!0,h=null,document.body.classList.add("pm-selecting"),it(),document.addEventListener("mousemove",W,!0),document.addEventListener("scroll",G,{capture:!0,passive:!0}),document.addEventListener("click",j,!0),document.addEventListener("mouseup",Y,!0),document.addEventListener("keydown",V,!0)}function T(){f&&(f=!1,h=null,document.body.classList.remove("pm-selecting"),at(),H(),v(),document.removeEventListener("mousemove",W,!0),document.removeEventListener("scroll",G,!0),document.removeEventListener("click",j,!0),document.removeEventListener("mouseup",Y,!0),document.removeEventListener("keydown",V,!0))}function $(t){return t?!!(t.closest("#pm-banner")||t.closest("#pm-hover-box")||t.closest(".pm-confirm-dialog")||t.closest(".pm-wrapper")||t.classList?.contains("pm-wrapper")):!1}function N(t){if(!(t instanceof HTMLElement)||t.tagName==="HTML"||t.tagName==="BODY"||$(t))return null;let e=t.tagName.toLowerCase();return["span","p","a","button","strong","em","b","i","label","td","th","li","h1","h2","h3","h4","h5","h6","code","pre"].includes(e)?t:t.children.length===1&&t.children[0]instanceof HTMLElement&&N(t.children[0])||t}function W(t){if(!f||s)return;let e=document.elementFromPoint(t.clientX,t.clientY);if(!e||$(e))return;let n=N(e);n&&n!==h?(h=n,J(n)):n||(h=null,H())}function G(){h&&!s&&J(h)}function Y(t){if(!f||s)return;let e=window.getSelection();if(!e||e.isCollapsed)return;let n=e.toString().trim();if(!n)return;let r=e.getRangeAt(0).commonAncestorContainer;r.nodeType===Node.TEXT_NODE&&(r=r.parentElement),r instanceof HTMLElement&&!$(r)&&(t.stopPropagation(),Q(r,n))}function j(t){if(!f)return;let e=t.target;if($(e))return;let n=window.getSelection();if(n&&!n.isCollapsed&&n.toString().trim()){t.preventDefault(),t.stopPropagation();return}if(t.preventDefault(),t.stopPropagation(),s)return;let o=h||N(e);o&&Q(o,o.textContent?.trim()||`<${o.tagName.toLowerCase()}>`)}function V(t){t.key==="Escape"&&(t.preventDefault(),t.stopPropagation(),s?v():(T(),y()))}function J(t){x||(x=document.createElement("div"),x.id="pm-hover-box",document.body.appendChild(x));let e=t.getBoundingClientRect();x.style.cssText=`
    position:fixed!important;top:${e.top}px!important;left:${e.left}px!important;
    width:${e.width}px!important;height:${e.height}px!important;
    display:block!important;pointer-events:none!important;
    z-index:2147483645!important;box-sizing:border-box!important;
    border:2px solid #FF3B30!important;background:rgba(255,59,48,.1)!important;
    border-radius:3px!important;outline:2px dashed rgba(255,59,48,.4)!important;
    outline-offset:2px!important;
  `}function H(){x?.remove(),x=null}function it(){document.getElementById("pm-banner")||(g=document.createElement("div"),g.id="pm-banner",g.style.cssText=`
    position:fixed!important;top:14px!important;left:50%!important;
    transform:translateX(-50%)!important;z-index:2147483647!important;
    background:#18191f!important;color:#fff!important;
    border:1.5px solid #FF3B30!important;border-radius:100px!important;
    padding:9px 20px!important;display:flex!important;align-items:center!important;
    gap:14px!important;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif!important;
    font-size:13px!important;font-weight:600!important;
    box-shadow:0 4px 24px rgba(255,59,48,.4),0 2px 10px rgba(0,0,0,.5)!important;
    white-space:nowrap!important;pointer-events:auto!important;
  `,g.innerHTML=`
    <span>\u{1F3AF} Privacy Mask \u2014 hover an element and click to mask it</span>
    <button id="pm-cancel-btn" style="background:rgba(255,59,48,.15)!important;color:#ff5247!important;
      border:1px solid rgba(255,59,48,.5)!important;border-radius:100px!important;
      padding:4px 14px!important;font-size:11px!important;font-weight:700!important;
      cursor:pointer!important;font-family:inherit!important;">Cancel (ESC)</button>
  `,document.body.appendChild(g),g.querySelector("#pm-cancel-btn")?.addEventListener("click",t=>{t.stopPropagation(),T(),y()}))}function at(){g?.remove(),g=null}function Q(t,e){v(),H();let n=e.length>120?e.slice(0,117)+"\u2026":e;s=document.createElement("div"),s.className="pm-confirm-dialog",s.style.cssText=`
    position:fixed!important;top:50%!important;left:50%!important;
    transform:translate(-50%,-50%)!important;z-index:2147483647!important;
    background:#1a1b22!important;color:#e8e9ef!important;
    border:1px solid #2e3040!important;border-radius:14px!important;
    padding:24px!important;width:370px!important;max-width:92vw!important;
    box-sizing:border-box!important;
    box-shadow:0 24px 60px rgba(0,0,0,.8),0 0 0 1px rgba(255,59,48,.15)!important;
    font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif!important;
  `;let o=i=>i.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#039;");s.innerHTML=`
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:16px;">
      <span style="font-size:16px;">\u{1F512}</span>
      <strong style="font-size:15px;color:#fff;flex:1;">Confirm Mask</strong>
      <span id="pm-dlg-close" style="cursor:pointer;color:#606472;font-size:18px;padding:2px 6px;" title="Cancel">\u2715</span>
    </div>

    <div style="font-size:11px;font-weight:600;color:#787c8e;text-transform:uppercase;letter-spacing:.6px;margin-bottom:6px;">Content to mask</div>
    <div style="background:#12131a;border:1px solid #272936;border-radius:8px;padding:10px 12px;
      font-family:monospace;font-size:12px;color:#5bcffa;max-height:80px;overflow-y:auto;
      word-break:break-all;margin-bottom:16px;">${o(n)}</div>

    <label style="display:block;font-size:11px;font-weight:600;color:#8a8fa8;margin-bottom:5px;">Mask replacement text</label>
    <input id="pm-mask-input" type="text" value="${o(E)}"
      style="width:100%!important;background:#12131a!important;border:1.5px solid #2b2d3d!important;
      border-radius:8px!important;color:#e8e9ef!important;padding:9px 12px!important;
      font-size:13px!important;box-sizing:border-box!important;margin-bottom:14px!important;
      font-family:inherit!important;outline:none!important;" />

    <label style="display:block;font-size:11px;font-weight:600;color:#8a8fa8;margin-bottom:8px;">Apply to</label>
    <div style="display:flex;flex-direction:column;gap:8px;margin-bottom:20px;">
      <label style="display:flex;align-items:center;gap:8px;font-size:12px;color:#b0b5cb;cursor:pointer;">
        <input type="radio" name="pm-scope" value="domain" checked style="accent-color:#FF3B30;" />
        Entire website (<code style="color:#5bcffa;font-size:11px;">${o(location.hostname)}</code>)
      </label>
      <label style="display:flex;align-items:center;gap:8px;font-size:12px;color:#b0b5cb;cursor:pointer;">
        <input type="radio" name="pm-scope" value="page" style="accent-color:#FF3B30;" />
        This page only
      </label>
    </div>

    <div style="display:flex;gap:8px;">
      <button id="pm-dlg-confirm" style="flex:1!important;background:linear-gradient(135deg,#ff3b30,#d92d22)!important;
        color:#fff!important;border:none!important;border-radius:8px!important;padding:11px!important;
        font-size:13px!important;font-weight:700!important;cursor:pointer!important;font-family:inherit!important;
        box-shadow:0 3px 12px rgba(255,59,48,.4)!important;">\u2713 Mask It</button>
      <button id="pm-dlg-reselect" style="background:#22242e!important;color:#8a8fa8!important;
        border:1px solid #2e3040!important;border-radius:8px!important;padding:11px 18px!important;
        font-size:13px!important;cursor:pointer!important;font-family:inherit!important;">\u21A9 Re-select</button>
    </div>
  `,document.body.appendChild(s),s.addEventListener("click",i=>i.stopPropagation()),s.addEventListener("mousedown",i=>i.stopPropagation()),s.addEventListener("mouseup",i=>i.stopPropagation());let r=s.querySelector("#pm-mask-input");setTimeout(()=>r?.focus(),60),s.querySelector("#pm-dlg-confirm")?.addEventListener("click",async i=>{i.stopPropagation();let m=r?.value.trim()||E,l=s.querySelector('input[name="pm-scope"]:checked')?.value??"domain",d=t;v(),T();let _=nt(d),z=O(d),P={id:`pm_${Date.now()}_${Math.random().toString(36).slice(2,6)}`,hostname:location.hostname,pathname:location.pathname,matchScope:l,mode:"text",cssSelector:_,domPath:z,selector:{cssSelector:_,path:z,tagName:d.tagName.toLowerCase()},originalText:e.slice(0,500),maskText:m,createdAt:Date.now(),updatedAt:Date.now(),enabled:!0};try{await tt(P),C(d,P),c.push(P),u.delete(P.id),q("\u2713 Masked & saved!"),y()}catch(Z){console.error("[PM] Save failed:",Z),q("\u274C Error saving \u2014 check console")}}),s.querySelector("#pm-dlg-reselect")?.addEventListener("click",i=>{i.stopPropagation(),v()}),s.querySelector("#pm-dlg-close")?.addEventListener("click",i=>{i.stopPropagation(),v(),T(),y()})}function v(){s?.remove(),s=null}function q(t){let e=document.createElement("div"),n=!t.startsWith("\u274C");e.style.cssText=`
    position:fixed!important;bottom:24px!important;right:24px!important;
    z-index:2147483647!important;background:${n?"#10b981":"#dc2626"}!important;
    color:#fff!important;padding:12px 20px!important;border-radius:10px!important;
    font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif!important;
    font-size:13px!important;font-weight:700!important;
    box-shadow:0 4px 20px rgba(0,0,0,.4)!important;pointer-events:none!important;
  `,e.textContent=t,document.body.appendChild(e),setTimeout(()=>e.remove(),2500)}function y(){try{if(chrome?.runtime?.id){let t=c.filter(e=>e.enabled).length;chrome.runtime.sendMessage({type:"PAGE_STATUS_RESPONSE",payload:{hostname:location.hostname,pathname:location.pathname,activeCount:t,totalCount:c.length,isPaused:!1,isSelecting:f,rules:c}}).catch(()=>{})}}catch{}}function st(){if(document.getElementById("pm-styles"))return;let t=document.createElement("style");t.id="pm-styles",t.textContent=`
    body.pm-selecting, body.pm-selecting * { cursor:crosshair!important; }

    .pm-wrapper {
      display:inline-flex!important;align-items:center!important;
      background:transparent!important;border:none!important;
      border-radius:0!important;padding:0!important;
      margin:0!important;vertical-align:baseline!important;
      box-shadow:none!important;gap:2px!important;
      position:relative!important;
    }
    .pm-wrapper[data-pm-revealed="true"] .pm-text {
      color:inherit!important;font-weight:inherit!important;
      letter-spacing:normal!important;font-family:inherit!important;
      background:transparent!important;
    }
    .pm-text {
      display:inline!important;color:inherit!important;font-weight:inherit!important;
      letter-spacing:normal!important;user-select:none!important;
      font-family:inherit!important;font-size:inherit!important;
    }
    .pm-eye {
      background:transparent!important;border:none!important;color:inherit!important;
      font-size:11px!important;cursor:pointer!important;padding:0 2px!important;
      margin:0!important;line-height:1!important;opacity:0!important;
      transition:opacity .15s!important;display:inline-flex!important;
      align-items:center!important;flex-shrink:0!important;
    }
    .pm-wrapper:hover .pm-eye { opacity:0.75!important; }
    .pm-eye:hover { opacity:1!important; }

    [data-pm-block="true"] { position:relative!important; }
    [data-pm-block="true"]::after {
      content:attr(data-pm-masktext)!important;position:absolute!important;
      inset:0!important;background:inherit!important;
      border:none!important;color:inherit!important;
      font-family:inherit!important;font-size:inherit!important;font-weight:inherit!important;
      letter-spacing:normal!important;display:flex!important;align-items:center!important;
      justify-content:center!important;user-select:none!important;
      z-index:9999!important;border-radius:inherit!important;
    }
  `,(document.head||document.documentElement).appendChild(t)}chrome.runtime.onMessage.addListener((t,e,n)=>{switch(t.type){case"START_MASKING":rt(),n({success:!0});break;case"CANCEL_SELECTION":T(),y(),n({success:!0});break;case"GET_PAGE_STATUS":{let o=c.filter(r=>r.enabled).length;n({hostname:location.hostname,pathname:location.pathname,activeCount:o,totalCount:c.length,isPaused:!1,isSelecting:f,rules:c});break}case"TEMPORARY_REVEAL":{let o=t.payload?.ruleId,r=c.find(i=>i.id===o);r&&K(r.id,r.maskText||E),n({success:!!r});break}case"REMOVE_RULE":{let o=t.payload?.ruleId;o&&(X(o),c=c.filter(r=>r.id!==o),u.delete(o),y()),n({success:!0});break}case"REAPPLY_MASKS":case"RULES_UPDATED":return R(),c=[],u.clear(),k().then(()=>n({success:!0})),!0;default:n({success:!1})}return!0});var w=null,lt=new MutationObserver(()=>{f||c.length===0||(w&&clearTimeout(w),w=setTimeout(async()=>{for(let t of c){if(!t.enabled||document.querySelector(`[${p}="${t.id}"]`))continue;let e=u.get(t.id)??0;if(e>=3)continue;let n=U(t);n?(C(n,t),u.delete(t.id)):u.set(t.id,e+1)}},500))}),D=location.href,ct=new MutationObserver(()=>{location.href!==D&&(D=location.href,R(),c=[],u.clear(),setTimeout(()=>k(),700))});async function F(){st(),await k(),lt.observe(document.body,{childList:!0,subtree:!0}),ct.observe(document,{subtree:!0,childList:!0}),typeof chrome<"u"&&chrome.storage?.onChanged&&chrome.storage.onChanged.addListener((t,e)=>{e==="local"&&t[S]&&(R(),c=[],u.clear(),k())})}document.readyState==="loading"?document.addEventListener("DOMContentLoaded",()=>F()):F();})();
