"use strict";(()=>{var u="data-pm-host",g="data-pm-wrap",P="data-pm-orig",L="privacy_mask_rules_v2",M="\u2588\u2588\u2588\u2588";async function H(){return new Promise(t=>{try{chrome.storage.local.get([L],e=>{if(chrome.runtime.lastError){console.error("[PM] Storage read error:",chrome.runtime.lastError),t([]);return}let n=e[L];t(Array.isArray(n)?n:[])})}catch(e){console.error("[PM] Storage exception:",e),t([])}})}async function V(t){return new Promise(async(e,n)=>{try{let r=await H(),o=r.findIndex(i=>i.id===t.id);o>=0?r[o]=t:r.push(t),chrome.storage.local.set({[L]:r},()=>{chrome.runtime.lastError?(console.error("[PM] Storage write error:",chrome.runtime.lastError),n(chrome.runtime.lastError)):(console.log("[PM] Rule saved. Total rules:",r.length),e())})}catch(r){n(r)}})}async function J(){let t=await H(),e=location.hostname,n=location.pathname;return t.filter(r=>{let o=r.hostname.toLowerCase(),i=e.toLowerCase();return o===i||i.endsWith("."+o)||o.endsWith("."+i)?r.matchScope==="page"?r.pathname===n:!0:!1})}function z(t){let e=[],n=t;for(;n&&n!==document.body&&n!==document.documentElement;){let r=n.tagName.toLowerCase(),o=n.parentElement;if(!o)break;if(n.id&&!_(n.id)){e.unshift(`#${CSS.escape(n.id)}`);break}let i=Array.from(o.children).filter(v=>v.tagName===n.tagName),a=i.indexOf(n)+1,c=i.length>1?`${r}:nth-of-type(${a})`:r;e.unshift(c),n=o}return e.join(" > ")}function _(t){return/^(:r|ember|react-aria|uid-|mui-|\d)/.test(t)||/\d{4,}/.test(t)}function Q(t){if(t.id&&!_(t.id))return`#${CSS.escape(t.id)}`;for(let e of["data-testid","data-test","data-qa","data-cy"]){let n=t.getAttribute(e);if(n)return`[${e}="${CSS.escape(n)}"]`}return z(t)}var d=new Map;function F(t){try{let e=document.querySelector(t.cssSelector);if(e)return e}catch{}try{let e=document.querySelector(t.domPath);if(e)return e}catch{}if(t.originalText&&t.originalText.length>0){let e=document.querySelectorAll("span, p, td, th, div, h1, h2, h3, h4, h5, h6, li, label, strong, b, a");for(let n of e)if((n.textContent||"").trim()===t.originalText.trim())return n;for(let n of e)if(t.originalText.length>10&&(n.textContent||"").trim().includes(t.originalText.trim()))return n}return null}function $(t,e){if(t.getAttribute(u)===e.id)return!0;t.setAttribute(u,e.id);let n=Z(t);if(n.length===0)return t.setAttribute("data-pm-block","true"),t.setAttribute("data-pm-masktext",e.maskText||M),!0;for(let r of n){let o=r.textContent||"";if(!o.trim())continue;let i=document.createElement("span");i.className="pm-wrapper",i.setAttribute(g,e.id),i.setAttribute(P,o);let a=document.createElement("span");a.className="pm-text",a.textContent=e.maskText||M;let c=document.createElement("button");c.className="pm-eye",c.type="button",c.title="Reveal temporarily",c.textContent="\u{1F441}",c.addEventListener("click",v=>{v.stopPropagation(),v.preventDefault(),q(e)}),i.appendChild(a),i.appendChild(c),r.parentNode?.replaceChild(i,r)}return!0}function Z(t){let e=[],n=document.createTreeWalker(t,NodeFilter.SHOW_TEXT,{acceptNode(o){return o.parentElement?.closest(`[${g}]`)?NodeFilter.FILTER_REJECT:(o.textContent||"").trim()?NodeFilter.FILTER_ACCEPT:NodeFilter.FILTER_SKIP}}),r;for(;r=n.nextNode();)e.push(r);return e}function tt(t){document.querySelectorAll(`[${g}="${t}"]`).forEach(n=>{let r=n.getAttribute(P)||"";n.parentNode?.replaceChild(document.createTextNode(r),n)}),document.querySelectorAll(`[${u}="${t}"]`).forEach(n=>{n.removeAttribute(u),n.removeAttribute("data-pm-block"),n.removeAttribute("data-pm-masktext")});let e=d.get(t);e&&(clearTimeout(e),d.delete(t))}function D(){document.querySelectorAll(`[${g}]`).forEach(t=>{let e=t.getAttribute(P)||"";t.parentNode?.replaceChild(document.createTextNode(e),t)}),document.querySelectorAll(`[${u}]`).forEach(t=>{t.removeAttribute(u),t.removeAttribute("data-pm-block"),t.removeAttribute("data-pm-masktext")}),d.forEach(clearTimeout),d.clear()}function q(t,e=5){let n=d.get(t.id);n&&(clearTimeout(n),d.delete(t.id)),document.querySelectorAll(`[${g}="${t.id}"]`).forEach(o=>{let i=o.getAttribute(P)||"",a=o.querySelector(".pm-text");a&&(a.textContent=i),o.setAttribute("data-pm-revealed","true")});let r=setTimeout(()=>{document.querySelectorAll(`[${g}="${t.id}"]`).forEach(o=>{let i=o.querySelector(".pm-text");i&&(i.textContent=t.maskText||M),o.removeAttribute("data-pm-revealed")}),d.delete(t.id)},e*1e3);d.set(t.id,r)}var l=[];async function w(){l=await J(),console.log("[PM] Applying",l.length,"rules for",location.hostname);for(let t of l){if(!t.enabled)continue;if(document.querySelector(`[${u}="${t.id}"]`)){console.log("[PM] Rule already applied:",t.id);continue}let e=F(t);e?(console.log("[PM] Found element for rule",t.id,"\u2192",e.tagName),$(e,t)):console.warn("[PM] Element not found for rule:",t.id,t.cssSelector)}x()}var p=!1,h=null,f=null,m=null,s=null;function et(){p&&y(),p=!0,console.log("[PM] Selection mode started"),document.body.classList.add("pm-selecting"),nt(),document.addEventListener("mousemove",I,!0),document.addEventListener("scroll",B,{capture:!0,passive:!0}),document.addEventListener("click",U,!0),document.addEventListener("mouseup",O,!0),document.addEventListener("keydown",K,!0)}function y(){p&&(p=!1,h=null,console.log("[PM] Selection mode stopped"),document.body.classList.remove("pm-selecting"),ot(),W(),b(),document.removeEventListener("mousemove",I,!0),document.removeEventListener("scroll",B,!0),document.removeEventListener("click",U,!0),document.removeEventListener("mouseup",O,!0),document.removeEventListener("keydown",K,!0))}function T(t){return t?!!(t.closest("#pm-banner")||t.closest("#pm-hover-box")||t.closest(".pm-confirm-dialog")||t.closest(`[${g}]`)):!1}function A(t){if(!t||!(t instanceof HTMLElement)||t.tagName==="HTML"||t.tagName==="BODY"||T(t))return null;let e=t.tagName.toLowerCase();return["span","p","a","button","strong","em","b","i","label","td","th","li","h1","h2","h3","h4","h5","h6","code","pre","input","textarea","div"].includes(e)?t:t.children.length===1&&t.children[0]instanceof HTMLElement&&A(t.children[0])||t}function I(t){if(!p||s)return;let e=document.elementFromPoint(t.clientX,t.clientY);if(!e||T(e))return;let n=A(e);n&&n!==h&&(h=n,G(n))}function B(){h&&!s&&G(h)}function O(t){if(!p||s)return;let e=window.getSelection();if(e&&!e.isCollapsed){let n=e.toString().trim();if(n.length>0){let o=e.getRangeAt(0).commonAncestorContainer;o.nodeType===Node.TEXT_NODE&&(o=o.parentElement),o instanceof HTMLElement&&!T(o)&&(t.stopPropagation(),Y(o,n))}}}function U(t){if(!p)return;let e=t.target;if(T(e))return;let n=window.getSelection();if(n&&!n.isCollapsed&&n.toString().trim().length>0){t.preventDefault(),t.stopPropagation();return}if(t.preventDefault(),t.stopPropagation(),s)return;let r=h||A(e);if(!r)return;let o=r.textContent?.trim()||`<${r.tagName.toLowerCase()}>`;Y(r,o)}function K(t){t.key==="Escape"&&(t.preventDefault(),t.stopPropagation(),s?b():(y(),x()))}function G(t){f||(f=document.createElement("div"),f.id="pm-hover-box",document.body.appendChild(f));let e=t.getBoundingClientRect();f.style.cssText=`
    position: fixed !important;
    top: ${e.top}px !important;
    left: ${e.left}px !important;
    width: ${e.width}px !important;
    height: ${e.height}px !important;
    display: block !important;
    pointer-events: none !important;
    z-index: 2147483645 !important;
    box-sizing: border-box !important;
    border: 2px solid #FF3B30 !important;
    background: rgba(255,59,48,0.08) !important;
    border-radius: 3px !important;
    outline: 2px dashed rgba(255,59,48,0.35) !important;
    outline-offset: 2px !important;
  `}function W(){f?.remove(),f=null}function nt(){document.getElementById("pm-banner")||(m=document.createElement("div"),m.id="pm-banner",m.style.cssText=`
    position: fixed !important;
    top: 14px !important;
    left: 50% !important;
    transform: translateX(-50%) !important;
    z-index: 2147483647 !important;
    background: #18191f !important;
    color: #fff !important;
    border: 1.5px solid #FF3B30 !important;
    border-radius: 100px !important;
    padding: 9px 20px !important;
    display: flex !important;
    align-items: center !important;
    gap: 14px !important;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif !important;
    font-size: 13px !important;
    font-weight: 600 !important;
    box-shadow: 0 4px 24px rgba(255,59,48,0.4), 0 2px 10px rgba(0,0,0,0.5) !important;
    white-space: nowrap !important;
    pointer-events: auto !important;
    animation: pm-slide-in 0.2s ease-out !important;
  `,m.innerHTML=`
    <span>\u{1F3AF} Privacy Mask \u2014 hover over an element and click to mask it</span>
    <button id="pm-cancel-btn" style="
      background: rgba(255,59,48,0.15) !important;
      color: #ff5247 !important;
      border: 1px solid rgba(255,59,48,0.5) !important;
      border-radius: 100px !important;
      padding: 4px 14px !important;
      font-size: 11px !important;
      font-weight: 700 !important;
      cursor: pointer !important;
      font-family: inherit !important;
    ">Cancel (ESC)</button>
  `,document.body.appendChild(m),m.querySelector("#pm-cancel-btn")?.addEventListener("click",t=>{t.stopPropagation(),y(),x()}))}function ot(){m?.remove(),m=null}function Y(t,e){b(),W();let n=location.hostname,r=e.length>120?e.slice(0,117)+"\u2026":e,o=M;s=document.createElement("div"),s.className="pm-confirm-dialog",s.style.cssText=`
    position: fixed !important;
    top: 50% !important;
    left: 50% !important;
    transform: translate(-50%, -50%) !important;
    z-index: 2147483647 !important;
    background: #1a1b22 !important;
    color: #e8e9ef !important;
    border: 1px solid #2e3040 !important;
    border-radius: 14px !important;
    padding: 24px !important;
    width: 370px !important;
    max-width: 92vw !important;
    box-sizing: border-box !important;
    box-shadow: 0 24px 60px rgba(0,0,0,0.8), 0 0 0 1px rgba(255,59,48,0.15) !important;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif !important;
  `,s.innerHTML=`
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:16px;">
      <span style="font-size:16px;">\u{1F512}</span>
      <strong style="font-size:15px;color:#fff;">Confirm Mask Selection</strong>
      <span id="pm-close-btn" style="margin-left:auto;cursor:pointer;color:#606472;font-size:18px;line-height:1;padding:2px 6px;" title="Cancel">\u2715</span>
    </div>

    <div style="font-size:11px;font-weight:600;color:#787c8e;text-transform:uppercase;letter-spacing:0.6px;margin-bottom:6px;">Content to mask</div>
    <div style="background:#12131a;border:1px solid #272936;border-radius:8px;padding:10px 12px;font-family:monospace;font-size:12px;color:#5bcffa;max-height:80px;overflow-y:auto;word-break:break-all;margin-bottom:16px;">${S(r)}</div>

    <label style="display:block;font-size:11px;font-weight:600;color:#8a8fa8;margin-bottom:5px;">Mask replacement text</label>
    <input id="pm-mask-input" type="text" value="${S(o)}" style="
      width:100% !important;
      background:#12131a !important;
      border:1.5px solid #2b2d3d !important;
      border-radius:8px !important;
      color:#e8e9ef !important;
      padding:9px 12px !important;
      font-size:13px !important;
      box-sizing:border-box !important;
      margin-bottom:14px !important;
      font-family:inherit !important;
      outline:none !important;
    " />

    <label style="display:block;font-size:11px;font-weight:600;color:#8a8fa8;margin-bottom:8px;">Apply to</label>
    <div style="display:flex;flex-direction:column;gap:8px;margin-bottom:20px;">
      <label style="display:flex;align-items:center;gap:8px;font-size:12px;color:#b0b5cb;cursor:pointer;">
        <input type="radio" name="pm-scope" value="domain" checked style="accent-color:#FF3B30;" />
        Entire website (<code style="color:#5bcffa;font-size:11px;">${S(n)}</code>)
      </label>
      <label style="display:flex;align-items:center;gap:8px;font-size:12px;color:#b0b5cb;cursor:pointer;">
        <input type="radio" name="pm-scope" value="page" style="accent-color:#FF3B30;" />
        This page only
      </label>
    </div>

    <div style="display:flex;gap:8px;">
      <button id="pm-confirm-btn" style="
        flex:1 !important;
        background:linear-gradient(135deg,#ff3b30,#d92d22) !important;
        color:#fff !important;
        border:none !important;
        border-radius:8px !important;
        padding:11px !important;
        font-size:13px !important;
        font-weight:700 !important;
        cursor:pointer !important;
        font-family:inherit !important;
        box-shadow:0 3px 12px rgba(255,59,48,0.4) !important;
      ">\u2713 Mask It</button>
      <button id="pm-reselect-btn" style="
        background:#22242e !important;
        color:#8a8fa8 !important;
        border:1px solid #2e3040 !important;
        border-radius:8px !important;
        padding:11px 18px !important;
        font-size:13px !important;
        cursor:pointer !important;
        font-family:inherit !important;
      ">\u21A9 Re-select</button>
    </div>
  `,document.body.appendChild(s),s.addEventListener("click",a=>a.stopPropagation()),s.addEventListener("mousedown",a=>a.stopPropagation());let i=s.querySelector("#pm-mask-input");setTimeout(()=>i?.focus(),50),s.querySelector("#pm-confirm-btn")?.addEventListener("click",async a=>{a.stopPropagation();let c=i?.value.trim()||o,X=s.querySelector('input[name="pm-scope"]:checked')?.value||"domain";b(),y();let E={id:`pm_${Date.now()}_${Math.random().toString(36).slice(2,6)}`,hostname:location.hostname,pathname:location.pathname,matchScope:X,cssSelector:Q(t),domPath:z(t),originalText:e.slice(0,500),maskText:c,createdAt:Date.now(),enabled:!0};console.log("[PM] Saving rule:",E);try{await V(E),$(t,E),l.push(E),C("\u2713 Element masked and saved!"),x()}catch(j){console.error("[PM] Failed to save rule:",j),C("\u274C Error saving mask rule")}}),s.querySelector("#pm-reselect-btn")?.addEventListener("click",a=>{a.stopPropagation(),b()}),s.querySelector("#pm-close-btn")?.addEventListener("click",a=>{a.stopPropagation(),b(),y(),x()})}function b(){s?.remove(),s=null}function C(t){let e=document.createElement("div");e.style.cssText=`
    position: fixed !important;
    bottom: 24px !important;
    right: 24px !important;
    z-index: 2147483647 !important;
    background: ${t.startsWith("\u274C")?"#dc2626":"#10b981"} !important;
    color: #fff !important;
    padding: 12px 20px !important;
    border-radius: 10px !important;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif !important;
    font-size: 13px !important;
    font-weight: 700 !important;
    box-shadow: 0 4px 20px rgba(0,0,0,0.4) !important;
    pointer-events: none !important;
  `,e.textContent=t,document.body.appendChild(e),setTimeout(()=>e.remove(),2500)}function x(){try{if(chrome?.runtime?.id){let t=l.filter(e=>e.enabled).length;chrome.runtime.sendMessage({type:"PAGE_STATUS_RESPONSE",payload:{hostname:location.hostname,pathname:location.pathname,activeCount:t,totalCount:l.length,isPaused:!1,isSelecting:p,rules:l}}).catch(()=>{})}}catch{}}function rt(){if(document.getElementById("pm-styles"))return;let t=document.createElement("style");t.id="pm-styles",t.textContent=`
    body.pm-selecting,
    body.pm-selecting * {
      cursor: crosshair !important;
    }

    .pm-wrapper {
      display: inline-flex !important;
      align-items: center !important;
      background: #1a1f2e !important;
      border: 1px solid rgba(255,59,48,0.55) !important;
      border-radius: 4px !important;
      padding: 1px 5px 1px 6px !important;
      margin: 0 1px !important;
      vertical-align: baseline !important;
      box-shadow: 0 1px 4px rgba(0,0,0,0.3) !important;
      gap: 3px !important;
    }

    .pm-wrapper[data-pm-revealed="true"] .pm-text {
      color: inherit !important;
      font-weight: inherit !important;
      letter-spacing: normal !important;
      font-family: inherit !important;
    }

    .pm-text {
      display: inline !important;
      color: #e8e9ef !important;
      font-weight: 700 !important;
      letter-spacing: 1px !important;
      user-select: none !important;
      font-family: monospace, sans-serif !important;
      font-size: 0.9em !important;
    }

    .pm-eye {
      background: transparent !important;
      border: none !important;
      color: #606472 !important;
      font-size: 11px !important;
      cursor: pointer !important;
      padding: 0 !important;
      margin: 0 !important;
      line-height: 1 !important;
      opacity: 0 !important;
      transition: opacity 0.15s !important;
      display: inline-flex !important;
      align-items: center !important;
    }

    .pm-wrapper:hover .pm-eye {
      opacity: 1 !important;
    }

    [data-pm-block="true"] {
      position: relative !important;
      overflow: hidden !important;
    }

    [data-pm-block="true"]::after {
      content: attr(data-pm-masktext) !important;
      position: absolute !important;
      inset: 0 !important;
      background: #1a1f2e !important;
      border: 1px solid rgba(255,59,48,0.5) !important;
      color: #e8e9ef !important;
      font-family: monospace !important;
      font-size: 13px !important;
      font-weight: 700 !important;
      letter-spacing: 2px !important;
      display: flex !important;
      align-items: center !important;
      justify-content: center !important;
      user-select: none !important;
      z-index: 9999 !important;
      border-radius: inherit !important;
    }

    @keyframes pm-slide-in {
      from { top: -50px; opacity: 0; }
      to   { top: 14px;  opacity: 1; }
    }
  `,(document.head||document.documentElement).appendChild(t)}function S(t){return t.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#039;")}chrome.runtime.onMessage.addListener((t,e,n)=>{switch(console.log("[PM] Message received:",t.type),t.type){case"START_MASKING":et(),n({success:!0});break;case"CANCEL_SELECTION":y(),x(),n({success:!0});break;case"GET_PAGE_STATUS":{let r=l.filter(o=>o.enabled).length;n({hostname:location.hostname,pathname:location.pathname,activeCount:r,totalCount:l.length,isPaused:!1,isSelecting:p,rules:l});break}case"TEMPORARY_REVEAL":{let r=t.payload?.ruleId,o=l.find(i=>i.id===r);o&&q(o),n({success:!0});break}case"REMOVE_RULE":{let r=t.payload?.ruleId;r&&(tt(r),l=l.filter(o=>o.id!==r),x()),n({success:!0});break}case"REAPPLY_MASKS":case"RULES_UPDATED":return D(),l=[],w().then(()=>n({success:!0})),!0;default:n({success:!1})}return!0});var k=null,it=new MutationObserver(()=>{p||(k&&clearTimeout(k),k=setTimeout(()=>{for(let t of l){if(!t.enabled||document.querySelector(`[${u}="${t.id}"]`))continue;let e=F(t);e&&(console.log("[PM] DOM changed \u2014 re-applying rule:",t.id),$(e,t))}},400))}),R=location.href,at=new MutationObserver(()=>{location.href!==R&&(R=location.href,console.log("[PM] URL changed \u2192 re-applying masks"),D(),l=[],setTimeout(()=>w(),500))});async function N(){rt(),await w(),it.observe(document.body,{childList:!0,subtree:!0}),at.observe(document,{subtree:!0,childList:!0}),console.log("[PM] Content script initialized on",location.hostname)}document.readyState==="loading"?document.addEventListener("DOMContentLoaded",()=>N()):N();})();
