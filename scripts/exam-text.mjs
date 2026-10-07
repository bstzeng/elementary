// Escape visible assessment text, then keep each written Zhuyin token atomic.
// Use only in text positions: never in attributes, URLs, IDs, SVG or <title>.
export function examText(value){
 const escaped=String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 return escaped.replace(/˙?[\u3105-\u312f\u31a0-\u31bf]+[ˉˊˇˋ˙]?/gu,syllable=>`<span class="zhuyin-syllable">${syllable}</span>`);
}
