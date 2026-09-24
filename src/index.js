<!doctype html><html lang="az"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"><title>Domino statistika</title>
<style>
:root{--bg:#f6f5f1;--fg:#1d1d1b;--mut:#6b6a63;--card:#fff;--bd:#e2e0d8;--ac:#0f766e;--bad:#b91c1c}
@media(prefers-color-scheme:dark){:root{--bg:#151514;--fg:#eceae2;--mut:#9a988e;--card:#1f1f1d;--bd:#33322e;--ac:#2dd4bf;--bad:#f87171}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--fg);font:15px/1.5 system-ui,-apple-system,sans-serif}
main{max-width:860px;margin:0 auto;padding:16px}.card{background:var(--card);border:1px solid var(--bd);border-radius:12px;padding:14px;margin:12px 0}
h1{font-size:20px;margin:6px 0}h2{font-size:15px;margin:0 0 8px}.mut{color:var(--mut)}.neg{color:var(--bad)}.sm{font-size:12px}
.row{display:flex;justify-content:space-between;align-items:end;gap:8px;flex-wrap:wrap}
table{border-collapse:collapse;width:100%;font-size:13px}.sc{overflow-x:auto}th,td{padding:5px 7px;border-bottom:1px solid var(--bd);text-align:center;white-space:nowrap}
th{color:var(--mut);cursor:pointer}td:nth-child(2),th:nth-child(2){text-align:left}
#lb td:nth-child(2){cursor:pointer;color:var(--ac);font-weight:600}
select,input,button,textarea{font:inherit;padding:7px;border-radius:8px;border:1px solid var(--bd);background:var(--bg);color:var(--fg)}
textarea{width:100%;resize:vertical;min-height:38px}
button{cursor:pointer}#pAdd,#gLogin,#aLogin,#add{background:var(--ac);color:#fff;border:0}
#fm,#login{display:flex;flex-wrap:wrap;gap:8px;align-items:end}label{display:flex;flex-direction:column;font-size:12px;color:var(--mut)}
.x td{opacity:.45;text-decoration:line-through}#err{color:var(--bad)}
.gr{display:grid;grid-template-columns:repeat(auto-fill,minmax(130px,1fr));gap:8px;margin:10px 0}.bx{border:1px solid var(--bd);border-radius:8px;padding:6px 8px;font-size:12px}.bx span{display:block;color:var(--mut)}.bx b{font-size:14px}
.two{display:grid;grid-template-columns:1fr 1fr;gap:12px}@media(max-width:600px){.two{grid-template-columns:1fr}}
.chip{border:1px solid var(--c);color:var(--c);background:none;border-radius:99px;padding:2px 10px;margin:2px;cursor:pointer;font:inherit;font-size:12px}.chip.on{background:var(--c);color:#fff}
svg{width:100%;height:auto}
.cm{font-size:12px;color:var(--mut);font-style:italic}
</style><script src="https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js"></script></head><body><main>
<h1>🎲 Domino statistika</h1>
<section class="card" id="loginBox"><h2>Giriş</h2><div id="login"></div><p id="err" class="sm"></p></section>
<div id="app" hidden>
<div class="row"><p class="mut sm" id="sub" style="margin:0"></p><label>Dövr<select id="ss"></select></label></div>
<section class="card"><h2>Yeni oyun</h2><div id="fm"></div><p id="ferr" class="neg sm"></p></section>
<section class="card"><h2>Reytinq (adına toxun: profil)</h2><div class="sc"><table id="lb"></table></div>
<p class="mut sm" style="margin-bottom:0">Xal: nəticə (1/2/3) qalib cütün hər üzvünə +, məğlub cütün hər üzvünə −. Elo: hamı 1000-dən başlayır, güclü rəqibi məğlub etmək çox, zəifi məğlub etmək az xal verir.</p></section>
<section class="card"><h2>Oyunçu profili</h2><div id="pf"></div></section>
<section class="card"><h2>MVP</h2><div id="mv"></div></section>
<section class="card"><h2>Xalın dəyişməsi</h2><div id="chips"></div><svg id="ch" viewBox="0 0 640 260"></svg></section>
<section class="card"><h2>Cüt uyğunluğu: birgə qələbə % (≥2 oyun)</h2><div class="sc"><table id="hm"></table></div></section>
<section class="card"><h2>Son oyunlar</h2><div class="sc" id="recent"></div></section>
<section class="card"><h2>Admin paneli</h2><div id="adm"></div></section>
</div>
</main>
<script>
const $=id=>document.getElementById(id),AZ=['Yanvar','Fevral','Mart','Aprel','May','İyun','İyul','Avqust','Sentyabr','Oktyabr','Noyabr','Dekabr'];
let GK=localStorage.getItem('gk')||'',AK=localStorage.getItem('ak')||'',ROLE=null,ST=null,sk='pts',on=null,ssn='',PROF=null;
async function api(path,opts={}){const h={...(opts.headers||{})};if(AK)h['x-admin-key']=AK;else if(GK)h['x-group-key']=GK;
const r=await fetch('/api'+path,{...opts,headers:h});const j=await r.json().catch(()=>({}));if(!r.ok){throw {status:r.status,msg:j.error||('xəta '+r.status)}}return j}
function loginForm(){$('login').innerHTML=`<label>Qrup açarı<input id="gk" value="${GK}"></label><button id="gLogin">Giriş</button> <span class="mut sm">və ya</span> <label>Admin açarı<input id="ak" type="password" value="${AK}"></label><button id="aLogin">Admin girişi</button>`;
$('gLogin').onclick=()=>{GK=$('gk').value.trim();AK='';localStorage.setItem('gk',GK);localStorage.removeItem('ak');boot()};
$('aLogin').onclick=()=>{AK=$('ak').value.trim();localStorage.setItem('ak',AK);boot()}}
async function boot(){loginForm();try{const w=await api('/whoami');ROLE=w.role;$('err').textContent='';$('app').hidden=false;await load()}catch(e){$('app').hidden=true;if(GK||AK)$('err').textContent='Giriş açarı yanlışdır.'}}
async function load(){ST=await api('/state');render()}
const col=k=>{const a=activePlayers();return`hsl(${a.findIndex(p=>p.id==k)*47} 65% 50%)`};
const mk=d=>d.slice(0,7),ml=k=>AZ[+k.slice(5,7)-1]+' '+k.slice(0,4);
function activePlayers(){return ST.players.filter(p=>!p.archived)}
function pname(id){const p=ST.players.find(x=>x.id==id);return p?p.name:'?'}
function actMatches(){return ST.matches.filter(m=>!m.cancelled&&(!ssn||mk(m.played_at)==ssn))}
function calc(ms){const P={};ST.players.forEach(p=>P[p.id]={...p,g:0,w:0,l:0,pts:0,s:0,bw:0,ms:0,ls:0,e:1000});
ms.forEach(m=>{const rw=(P[m.w1].e+P[m.w2].e)/2,rl=(P[m.l1].e+P[m.l2].e)/2,d=20/(1+10**((rw-rl)/400));
[[[m.w1,m.w2],1],[[m.l1,m.l2],-1]].forEach(([t,sg])=>t.forEach(id=>{const q=P[id];if(!q)return;q.g++;q.e+=sg*d;if(sg>0){q.w++;q.s=q.s>0?q.s+1:1;q.ms=Math.max(q.ms,q.s);if(m.result>1)q.bw++}else{q.l++;q.s=q.s<0?q.s-1:-1;q.ls=Math.max(q.ls,-q.s)}q.pts+=sg*m.result}))});
Object.values(P).forEach(q=>q.e=Math.round(q.e));return P}
function pairs(ms){const R={};ms.forEach(m=>{[[[m.w1,m.w2],1],[[m.l1,m.l2],0]].forEach(([t,x])=>{const k=[...t].sort((a,b)=>a-b).join(',');const q=R[k]||(R[k]={g:0,w:0});q.g++;q.w+=x})});return R}
function profStats(k,ms){const pa={},op={};ms.forEach(m=>{const iw=(m.w1==k||m.w2==k),il=(m.l1==k||m.l2==k);if(!iw&&!il)return;const my=iw?[m.w1,m.w2]:[m.l1,m.l2],ot=iw?[m.l1,m.l2]:[m.w1,m.w2],pt=my.find(x=>x!=k);
const a=pa[pt]||(pa[pt]={g:0,w:0});a.g++;a.w+=iw?1:0;ot.forEach(o=>{const b=op[o]||(op[o]={g:0,w:0});b.g++;b.w+=iw?1:0})});
const top=(o,f)=>Object.entries(o).filter(([x,v])=>v.g>=2).sort((a,b)=>f(b[1])-f(a[1]))[0];
return{pa:top(pa,v=>v.w/v.g),pw:top(pa,v=>-v.w/v.g),nem:top(op,v=>-v.w/v.g),vic:top(op,v=>v.w/v.g)}}
function chr(q,f){if(!q.g)return'Bu dövrdə oyunu yoxdur.';const wr=q.w/q.g*100,t=[wr>=55?'Sabit qalib tipidir':wr<=45?'Hazırda çətin dövr keçirir':'Nəticələri tarazlı olan oyunçudur'];
if(q.g>=6&&q.bw/Math.max(q.w,1)>=.15)t.push('böyük xallı (2–3) qələbələrə meyllidir');if(q.ms>=4)t.push(`ən uzun seriyası ${q.ms} qələbədir`);
if(f.pa&&f.pa[1].w/f.pa[1].g*100-wr>=12)t.push(`ən çox ${pname(f.pa[0])} ilə uğurludur`);if(f.nem&&f.nem[1].w/f.nem[1].g<.4)t.push(`${pname(f.nem[0])} qarşısında çətinlik çəkir`);return t.join(', ')+'.'}
function mvp(ms,kf){const D={};ms.forEach(m=>{const d=kf(m),o=D[d]||(D[d]={});[m.w1,m.w2].forEach(k=>o[k]=(o[k]||0)+m.result);[m.l1,m.l2].forEach(k=>o[k]=(o[k]||0)-m.result)});
return Object.entries(D).map(([d,o])=>{const e=Object.entries(o).sort((a,b)=>b[1]-a[1])[0];return[d,e[0],e[1]]}).reverse()}
function render(){
const A=actMatches(),P=calc(A),L=Object.values(P).filter(q=>q.g).sort((a,b)=>sk=='wr'?b.w/b.g-a.w/a.g:b[sk]-a[sk]);
$('sub').textContent=`${A.length} oyun · ${activePlayers().length} aktiv oyunçu · rol: ${ROLE}`;
$('ss').innerHTML='<option value="">Bütün dövr</option>'+[...new Set(ST.matches.map(m=>mk(m.played_at)))].sort().map(k=>`<option value="${k}" ${k==ssn?'selected':''}>${ml(k)}</option>`).join('');
$('lb').innerHTML='<tr>'+[['','#'],['','Oyunçu'],['g','Oyun'],['w','Q'],['l','M'],['wr','Q%'],['pts','Xal'],['e','Elo'],['','Seriya']].map(([k,t])=>`<th data-k="${k}">${t}</th>`).join('')+'</tr>'+
L.map((q,i)=>`<tr><td>${i+1}</td><td data-p="${q.id}">${q.name}</td><td>${q.g}</td><td>${q.w}</td><td>${q.l}</td><td>${Math.round(q.w/q.g*100)}%</td><td class="${q.pts<0?'neg':''}">${q.pts>0?'+':''}${q.pts}</td><td>${q.e}</td><td>${q.s>0?q.s+'Q':-q.s+'M'}</td></tr>`).join('');
const k0=(PROF&&P[PROF])?PROF:(L[0]?L[0].id:null);PROF=k0;
if(k0){const q=P[k0],f=profStats(k0,A),pc=x=>x?`${pname(x[0])} ${Math.round(x[1].w/x[1].g*100)}% (${x[1].g})`:'—',b=(t,v)=>`<div class="bx"><span>${t}</span><b>${v}</b></div>`;
$('pf').innerHTML=`<select id="ps">${activePlayers().map(p=>`<option value="${p.id}" ${p.id==k0?'selected':''}>${p.name}</option>`).join('')}</select>`+
(q.g?`<div class="gr">${b('Oyun',q.g)}${b('Qələbə %',Math.round(q.w/q.g*100)+'%')}${b('Xal',(q.pts>0?'+':'')+q.pts)}${b('Elo',q.e)}${b('Cari seriya',q.s>0?q.s+' Q':-q.s+' M')}${b('Ən uzun Q seriyası',q.ms)}${b('Ən uzun M seriyası',q.ls)}${b('Böyük qələbə (2–3)',q.bw)}${b('Ən yaxşı partnyor',pc(f.pa))}${b('Ən çətin partnyor',pc(f.pw))}${b('Ən çətin rəqib',pc(f.nem))}${b('Ən asan rəqib',pc(f.vic))}</div><p style="margin:0"><b>Xarakteristika:</b> ${chr(q,f)}</p><p class="mut sm" style="margin:4px 0 0">Partnyor/rəqib: ən azı 2 oyun.</p>`:'<p class="mut">Bu dövrdə oyunu yoxdur.</p>')}
else $('pf').innerHTML='<p class="mut">Hələ oyunçu yoxdur.</p>';
const t=(r,h)=>r.length?`<table><tr><th>${h}</th><th>MVP</th><th>Xal</th></tr>${r.map(([d,k,v])=>`<tr><td>${h=='Ay'?ml(d):d.slice(5,10)}</td><td>${pname(k)}</td><td>${v>0?'+':''}${v}</td></tr>`).join('')}</table>`:'<p class="mut sm">Məlumat yoxdur.</p>';
$('mv').innerHTML=`<div class="two"><div class="sc"><b>Günün MVP-si</b>${t(mvp(A,m=>m.played_at.slice(0,10)).slice(0,10),'Gün')}</div><div class="sc"><b>Ayın MVP-si</b>${t(mvp(ST.matches.filter(m=>!m.cancelled),m=>mk(m.played_at)),'Ay')}</div></div>`;
if(!on)on=new Set(L.slice(0,4).map(q=>q.id));
const vis=[...on].filter(k=>P[k]);let lo=0,hi=1;const cum={};vis.forEach(k=>cum[k]=[0]);
A.forEach(m=>{vis.forEach(k=>{const iw=(m.w1==k||m.w2==k),il=(m.l1==k||m.l2==k);const last=cum[k][cum[k].length-1];cum[k].push(last+(iw?m.result:il?-m.result:0))})});
vis.forEach(k=>cum[k].forEach(v=>{lo=Math.min(lo,v);hi=Math.max(hi,v)}));
const n=A.length||1,X=i=>30+i/n*600,Y=v=>240-(v-lo)/((hi-lo)||1)*220;
let s=`<line x1="30" x2="630" y1="${Y(0)}" y2="${Y(0)}" stroke="var(--bd)"/><text x="2" y="${Y(hi)+4}" fill="var(--mut)" font-size="10">${hi}</text><text x="2" y="${Y(lo)}" fill="var(--mut)" font-size="10">${lo}</text>`;
vis.forEach(k=>{s+=`<polyline fill="none" stroke-width="2" stroke="${col(k)}" points="${cum[k].map((v,i)=>X(i)+','+Y(v)).join(' ')}"/>`});$('ch').innerHTML=s;
$('chips').innerHTML=activePlayers().map(p=>`<button class="chip ${on.has(p.id)?'on':''}" data-c="${p.id}" style="--c:${col(p.id)}">${p.name}</button>`).join('');
const PR=pairs(A),ap=activePlayers();
$('hm').innerHTML='<tr><th></th>'+ap.map(p=>`<th>${p.name.slice(0,3)}</th>`).join('')+'</tr>'+ap.map(a=>`<tr><th>${a.name}</th>`+ap.map(c=>{if(a.id==c.id)return'<td></td>';const u=PR[[a.id,c.id].sort((x,y)=>x-y).join(',')];if(!u||u.g<2)return'<td class="mut">·</td>';const p=u.w/u.g*100;return`<td title="${u.w}/${u.g}" style="background:color-mix(in srgb,${p>=50?'var(--ac)':'var(--bad)'} ${Math.round(Math.abs(p-50)*1.6)}%,transparent)">${Math.round(p)}</td>`}).join('')+'</tr>').join('');
$('recent').innerHTML='<table><tr><th>Tarix</th><th>Qalib</th><th>Məğlub</th><th>Xal</th><th>Şərh</th></tr>'+[...ST.matches].slice(-15).reverse().map(m=>`<tr class="${m.cancelled?'x':''}"><td>${m.played_at.slice(0,16).replace('T',' ')}</td><td>${pname(m.w1)}–${pname(m.w2)}</td><td>${pname(m.l1)}–${pname(m.l2)}</td><td>${m.result}</td><td class="cm">${m.comment||''}</td></tr>`).join('')+'</table>';
frm();rAdm()}
function allPairs(exclude=[]){const a=activePlayers().filter(p=>!exclude.includes(p.id)),r=[];for(let i=0;i<a.length;i++)for(let j=i+1;j<a.length;j++)r.push([a[i],a[j]]);return r}
function frm(){const wv=$('wp')?.value,lv=$('lp')?.value,cmv=$('cm')?.value||'',W=allPairs(),pOpt=([x,y],v)=>`<option value="${x.id},${y.id}" ${v&&v===`${x.id},${y.id}`?'selected':''}>${x.name}–${y.name}</option>`;
if(!W.length){$('fm').innerHTML='<p class="mut sm">Oyuna başlamaq üçün ən azı 4 aktiv oyunçu lazımdır. Admin paneldən əlavə edin.</p>';return}
const wSel=(wv?wv.split(',').map(Number):[W[0][0].id,W[0][1].id]),L=allPairs(wSel);
$('fm').innerHTML=`<label>Qalib cütü<select id="wp">${W.map(p=>pOpt(p,wv)).join('')}</select></label>
<label>Uduzan cütü<select id="lp">${L.length?L.map(p=>pOpt(p,lv)).join(''):'<option value="">— fərqli qalib cütü seçin —</option>'}</select></label>
<label>Nəticə<select id="r"><option>1</option><option>2</option><option>3</option></select></label>
<label style="flex:1 1 200px">Şərh (könüllü)<textarea id="cm" placeholder="məs: Adil son əlde reş açdı" maxlength="300">${cmv}</textarea></label>
<button id="add">Əlavə et</button>`;
$('wp').onchange=()=>frm();
$('add').onclick=async()=>{$('ferr').textContent='';
if(!$('lp').value){$('ferr').textContent='Uduzan cütü seçin';return}
const w=$('wp').value.split(',').map(Number),l=$('lp').value.split(',').map(Number),r=+$('r').value,comment=$('cm').value.trim()||undefined;
try{await api('/matches',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({w,l,r,comment})});ssn='';await load()}
catch(e){if(e.status===409){if(confirm('Bu oyun artıq son oyun kimi qeyd olunub. Yenə də əlavə edilsin?')){try{await api('/matches',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({w,l,r,comment,confirm:true})});ssn='';await load()}catch(e2){$('ferr').textContent=e2.msg}}}
else $('ferr').textContent=e.msg}}}
function parseCSV(text){text=text.replace(/^\uFEFF/,'').replace(/\r\n/g,'\n');
const head0=text.split('\n')[0]||'';
const delim=(head0.match(/\t/g)||[]).length>=(head0.match(/,/g)||[]).length&&(head0.match(/\t/g)||[]).length>=(head0.match(/;/g)||[]).length?'\t':((head0.match(/;/g)||[]).length>(head0.match(/,/g)||[]).length?';':',');
const rows=[];let row=[],cur='',q=false,atStart=true;
for(let i=0;i<text.length;i++){const c=text[i];
if(q){if(c=='"'){if(text[i+1]=='"'){cur+='"';i++}else q=false}else cur+=c}
else{if(c=='"'&&atStart){q=true;atStart=false}else if(c==delim){row.push(cur);cur='';atStart=true}else if(c=='\n'){row.push(cur);rows.push(row);row=[];cur='';atStart=true}else{cur+=c;atStart=false}}}
if(cur.length||row.length){row.push(cur);rows.push(row)}
if(!rows.length)return[];
const head=rows[0].map(h=>h.trim().toLowerCase());
return rows.slice(1).filter(r=>r.some(c=>c.trim())).map(r=>{const o={};head.forEach((h,i)=>o[h]=(r[i]||'').trim());return o})}
function normDate(s){if(!s)return s;if(s instanceof Date){const p=n=>String(n).padStart(2,'0');return`${s.getFullYear()}-${p(s.getMonth()+1)}-${p(s.getDate())} ${p(s.getHours())}:${p(s.getMinutes())}:${p(s.getSeconds())}`}
s=String(s).trim();if(/^\d{4}-\d{2}-\d{2}/.test(s))return s;
const m=s.match(/^(\d{1,2})[.\/](\d{1,2})[.\/](\d{4})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
if(m){const[,mo,da,yr,hh,mi,ss]=m;return`${yr}-${mo.padStart(2,'0')}-${da.padStart(2,'0')} ${hh.padStart(2,'0')}:${mi}:${ss||'00'}`}
return s}
async function parseFile(file){const name=file.name.toLowerCase();
if(name.endsWith('.xlsx')||name.endsWith('.xls')){
const buf=await file.arrayBuffer();
const wb=XLSX.read(buf,{type:'array',cellDates:true});
const sheet=wb.Sheets[wb.SheetNames[0]];
const json=XLSX.utils.sheet_to_json(sheet,{defval:''});
return json.map(row=>{const o={};Object.keys(row).forEach(k=>{const kk=k.trim().toLowerCase();let v=row[k];o[kk]=(v instanceof Date)?v:String(v).trim()});return o})}
return parseCSV(await file.text())}
function rAdm(){if(ROLE!=='admin'){$('adm').innerHTML='<p class="mut sm">Yalnız admin görə bilər.</p>';return}
$('adm').innerHTML=`<p><input id="npName" placeholder="Yeni oyunçu adı"><button id="npAdd">Əlavə et</button>
&nbsp; <select id="dp">${activePlayers().map(p=>`<option value="${p.id}">${p.name}</option>`).join('')}</select><button id="dpDel">Sil/arxivlə</button>
&nbsp; <button id="csv">CSV yüklə</button> <button id="logbtn">Tarixçə</button>
&nbsp; <button id="resetBtn" style="border-color:var(--bad);color:var(--bad)">⚠ Hamısını sıfırla</button></p>
<div class="sc"><table>${[...ST.matches].slice(-25).reverse().map(m=>`<tr class="${m.cancelled?'x':''}"><td>${m.played_at.slice(0,16).replace('T',' ')}</td><td>${pname(m.w1)}–${pname(m.w2)}</td><td>${pname(m.l1)}–${pname(m.l2)}</td><td><select data-r="${m.id}"><option ${m.result==1?'selected':''}>1</option><option ${m.result==2?'selected':''}>2</option><option ${m.result==3?'selected':''}>3</option></select></td><td><button data-c="${m.id}" data-v="${m.cancelled?0:1}">${m.cancelled?'Bərpa':'Ləğv et'}</button></td></tr>`).join('')}</table></div>
<div id="logbox"></div>
<h3 style="font-size:14px">Toplu idxal (Excel .xlsx və ya CSV)</h3>
<p class="mut sm">Sütunlar (baş sətirdə, kiçik hərflə): <b>w1,w2,l1,l2,result</b> məcburi, <b>played_at</b> (məs: 2026-01-05 10:00:00) və <b>comment</b> könüllü. w1/w2 = qalib cütü, l1/l2 = məğlub cütü, oyunçu adları mətn kimi.</p>
<input type="file" id="impFile" accept=".xlsx,.xls,.csv"> <button id="impBtn">İdxal et</button>
<p id="impStatus" class="sm"></p>`;
$('npAdd').onclick=async()=>{try{await api('/admin/players',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({name:$('npName').value})});await load()}catch(e){alert(e.msg)}};
$('dpDel').onclick=async()=>{try{await api('/admin/players/'+$('dp').value,{method:'DELETE'});await load()}catch(e){alert(e.msg)}};
$('csv').onclick=()=>{const h=AK?{'x-admin-key':AK}:{};fetch('/api/admin/export.csv',{headers:h}).then(r=>r.blob()).then(b=>{const a=document.createElement('a');a.href=URL.createObjectURL(b);a.download='domino-oyunlar.csv';a.click()})};
$('logbtn').onclick=async()=>{const l=await api('/admin/log');$('logbox').innerHTML='<ul class="sm">'+l.map(x=>`<li>${x.at.slice(0,16).replace('T',' ')} — ${x.action}: ${x.detail||''}</li>`).join('')+'</ul>'};
document.querySelectorAll('[data-c]').forEach(b=>b.onclick=async()=>{try{await api('/admin/matches/'+b.dataset.c,{method:'PATCH',headers:{'content-type':'application/json'},body:JSON.stringify({cancelled:!!+b.dataset.v})});await load()}catch(e){alert(e.msg)}});
document.querySelectorAll('[data-r]').forEach(s=>s.onchange=async()=>{try{await api('/admin/matches/'+s.dataset.r,{method:'PATCH',headers:{'content-type':'application/json'},body:JSON.stringify({result:+s.value})});await load()}catch(e){alert(e.msg)}});
$('impBtn').onclick=async()=>{const f=$('impFile').files[0],st=$('impStatus');if(!f){st.textContent='Əvvəlcə fayl seçin';return}
let rows;try{rows=await parseFile(f)}catch(e){st.textContent='Fayl oxunmadı: '+e.message;return}
if(!rows.length){st.textContent='Fayl boşdur və ya sütunlar tanınmadı';return}
const need=['w1','w2','l1','l2','result'];if(!need.every(k=>k in rows[0])){st.textContent='Sütun adları uyğun deyil. Lazımdır: w1,w2,l1,l2,result';return}
st.textContent=`Faylda ${rows.length} sətir tapıldı. Göndərilir...`;await new Promise(r=>setTimeout(r,50));
rows.forEach(r=>{if(r.played_at)r.played_at=normDate(r.played_at)});
const CH=150;let done=0,created=new Set();
for(let i=0;i<rows.length;i+=CH){const chunk=rows.slice(i,i+CH);st.textContent=`Göndərilir: ${i+1}–${Math.min(i+CH,rows.length)} / ${rows.length}...`;
try{const r=await api('/admin/import',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({rows:chunk})});done+=r.inserted;r.created.forEach(n=>created.add(n))}
catch(e){st.textContent=`Xəta (sətir ${i+1} ətrafında): ${e.msg}. ${done} oyun uğurla əlavə olundu, davam etmək üçün faylı düzəldib qalanını yenidən yükləyin.`;await load();return}}
st.textContent=`Bitdi: ${done} oyun əlavə olundu, ${created.size} yeni oyunçu yaradıldı.`;await load()};
$('resetBtn').onclick=async()=>{const w=prompt('BÜTÜN oyunlar və oyunçular silinəcək, geri qaytarıla bilməz. Təsdiq üçün böyük hərflərlə RESET yazın:');
if(w!=='RESET')return;
try{await api('/admin/reset',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({confirm:'RESET'})});PROF=null;on=null;await load()}catch(e){alert(e.msg)}}}
$('ss').addEventListener('change',e=>{ssn=e.target.value;render()});
$('lb').addEventListener('click',e=>{const d=e.target.dataset;if(d.k){sk=d.k;render()}if(d.p){PROF=+d.p;render();$('pf').scrollIntoView({behavior:'smooth'})}});
$('pf').addEventListener('change',e=>{if(e.target.id=='ps'){PROF=+e.target.value;render()}});
$('chips').addEventListener('click',e=>{const k=e.target.dataset.c;if(k){const kk=+k;on.has(kk)?on.delete(kk):on.add(kk);render()}});
boot();
</script></body></html>
