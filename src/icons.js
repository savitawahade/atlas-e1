const paths={
  replay:'M3 10a9 9 0 1 1 2.6 8.4M3 4v6h6',
  play:'m8 5 11 7-11 7Z',pause:'M8 5v14M16 5v14',
  assemble:'m12 3 9 5-9 5-9-5Zm-9 9 9 5 9-5M3 16l9 5 9-5',
  walk:'M4 17h12m-5-5 5 5-5 5M5 9V4h14v5',
  labels:'M4 4h10l6 6-10 10-6-6Zm4 4h.01',
  guides:'M12 3v4m0 10v4M3 12h4m10 0h4M8 8h8v8H8Z',
  cutaway:'m12 3 9 5v9l-9 5-9-5V8Zm0 0v19M3 8l9 5 9-5',
  wireframe:'m12 3 9 5v9l-9 5-9-5V8Zm-9 5 9 5 9-5M12 13v9M3 17l9-14 9 14',
  hero:'m12 3 9 5v9l-9 5-9-5V8Zm-9 5 9 5 9-5M12 13v9',
  front:'M5 4h14v16H5ZM9 4v16M15 4v16',
  detail:'M10 18a8 8 0 1 1 0-16 8 8 0 0 1 0 16Zm6-2 6 6M7 10h6m-3-3v6',
  plus:'M12 5v14M5 12h14',minus:'M5 12h14',reset:'M3 10a9 9 0 1 1 2.6 8.4M3 4v6h6',
  arrow:'M5 19 19 5M7 5h12v12',eye:'M2 12s4-7 10-7 10 7 10 7-4 7-10 7-10-7-10-7Zm10-3a3 3 0 1 0 0 6 3 3 0 0 0 0-6'
};
export function icon(name){return `<svg class="ui-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${paths[name]||paths.assemble}"/></svg>`;}
