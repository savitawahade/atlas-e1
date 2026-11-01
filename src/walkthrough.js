// Recording-only normal arrow, positioned by actual pointer events.
// Capture the app window with showsCursor=false to exclude OS/recording overlays.
if (new URLSearchParams(location.search).has('walkthrough')) {
  const style = document.createElement('style');
  style.textContent = `
    html,body,body *{cursor:none!important}
    #recording-pointer{position:fixed;left:0;top:0;width:16px;height:23px;z-index:2147483647;pointer-events:none;display:none}
  `;
  document.head.append(style);
  // A readable recording layout, rendered at native Retina resolution.
  // Query-only so the normal exhibit keeps its existing responsive layout.
  if (new URLSearchParams(location.search).has('clarity')) {
    document.documentElement.classList.add('recording-clarity');
    const clarity = document.createElement('style');
    clarity.textContent = `
      @media(min-width:901px){
        .recording-clarity #app{font-size:14px}
        .recording-clarity main{grid-template-columns:210px minmax(0,1fr) 330px;gap:16px;padding:14px 18px 10px}
        .recording-clarity header{min-height:78px}
        .recording-clarity #app:not(.capture-mode) footer{min-height:86px;padding:10px 18px;gap:16px}
        .recording-clarity aside{gap:9px}
        .recording-clarity .control-block{padding:11px 12px}
        .recording-clarity .panel-heading{margin-bottom:7px}
        .recording-clarity .panel-label,.recording-clarity .inst-heading h3{font-size:11px;font-weight:600;letter-spacing:.3px}
        .recording-clarity .panel-index,.recording-clarity .chapter-kicker{font-size:10px;color:#405579}
        .recording-clarity .explanation h2{font-size:23px;margin:8px 0}
        .recording-clarity #chapter-copy{font-size:13px;line-height:1.45;min-height:0;color:#344973}
        .recording-clarity .telemetry{margin-top:9px;padding-top:8px}
        .recording-clarity .telemetry div>span{font-size:10px;letter-spacing:.2px}
        .recording-clarity .telemetry strong{font-size:14px}
        .recording-clarity .telemetry div:last-child strong{font-size:11px}
        .recording-clarity .actions button,.recording-clarity .display-controls button{font-size:13px;font-weight:650;min-height:36px}
        .recording-clarity .actions{margin-bottom:8px}
        .recording-clarity .range-label,.recording-clarity .range-endpoints{font-size:10px;color:#405579}
        .recording-clarity .display-note{font-size:11px;margin:6px 0 0;color:#405579}
        .recording-clarity .part-control{min-height:48px;padding:7px 3px}
        .recording-clarity .part-description strong{font-size:13px;font-weight:650}
        .recording-clarity .part-description small{font:10px/1.3 var(--sans);color:#52446e;margin-top:3px}
        .recording-clarity .part-indicator{font-size:10px;min-width:46px}
        .recording-clarity .part-number{font-size:10px}
        .recording-clarity .camera-button,.recording-clarity .tour,.recording-clarity #pause,.recording-clarity .chapters button{font-size:12px;font-weight:600}
        .recording-clarity .timeline-top,.recording-clarity .sequence-heading>.panel-label{font-size:10px;letter-spacing:.1px}
        .recording-clarity .playback-controls label,.recording-clarity .motor-readout{font-size:11px}
        .recording-clarity .inst-note,.recording-clarity .inst-legend,.recording-clarity .inst-bar-scale{font-size:10px;line-height:1.45}
        .recording-clarity .inst-summary>span,.recording-clarity .inst-attitude-readings dt,.recording-clarity .inst-speed>span,.recording-clarity .inst-speed>small{font-size:10px}
        .recording-clarity .inst-leg-name,.recording-clarity .inst-angle-value{font-size:12px}
        .recording-clarity .trunk-focus{font-size:12px}
        .recording-clarity .study-meta,.recording-clarity .study-actions button{font-size:11px}
        .recording-clarity #trunk-study-panel>p{font-size:11px;margin:6px 0}
      }
    `;
    document.head.append(clarity);
  }
  const pointer = document.createElement('div');
  pointer.id = 'recording-pointer';
  pointer.setAttribute('aria-hidden','true');
  pointer.innerHTML = '<svg viewBox="0 0 16 23" width="16" height="23"><path d="M1 1v18l4.5-4.3 3.4 7 3.1-1.6-3.4-6.6H15Z" fill="#111" stroke="#fff" stroke-width="1.15" stroke-linejoin="round"/></svg>';
  document.body.append(pointer);
  const position = event => {
    pointer.style.display = 'block';
    pointer.style.transform = `translate(${event.clientX}px,${event.clientY}px)`;
  };
  document.addEventListener('pointermove', position, true);
  document.addEventListener('pointerdown', position, true);
  document.addEventListener('pointerout', event => {
    if (!event.relatedTarget) pointer.style.display = 'none';
  });
}
