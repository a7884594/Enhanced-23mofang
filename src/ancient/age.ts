import {RESEARCH} from './profile';
/** Use the website's displayed formation age, not sample ages or relation counts. */
export function formationAge(text:string|null|undefined):number|null {
  const m=/形成时间\s*(?:距今)?\s*(?:约)?\s*([\d,]+(?:\.\d+)?)\s*(万)?\s*年/.exec(text||'');
  if(!m)return null;const value=Number(m[1].replaceAll(',',''))*(m[2]?10000:1);
  return Number.isFinite(value)&&value>=0?value:null;
}
export const showAncientEntry=(age:number|null)=>RESEARCH||age==null||age>=1000;
export function analysisAge(doc:Document):number|null {
  const heading=doc.querySelector('h1');if(!heading)return null;
  // The actual page places the age in a direct sibling <p> below its h1.
  for(const e of heading.parentElement?.children||[]){if(e.tagName==='P'){const age=formationAge(e.textContent);if(age!=null)return age;}}
  return null;
}
