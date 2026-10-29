'use strict';
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const KEY='bny-data-v1';
let db={tasks:[],events:[],contacts:[],notes:[],fired:{}};
try{db=Object.assign(db,JSON.parse(localStorage.getItem(KEY)||'{}'))}catch{}
let token=localStorage.getItem('bny-token')||'';
let myName=localStorage.getItem('bny-name')||'';
let myUser=localStorage.getItem('bny-user')||'';
let FAMU=(()=>{try{return JSON.parse(localStorage.getItem('bny-famfull')||'[]')}catch{return[]}})();
const isParent=()=>!!adminTok||myUser==='admin'||(FAMU.length?!!FAMU.find(u=>u.u===myUser&&u.p):['gil','adva'].includes(myUser));
const PALETTE=['#e0527a','#8e5bd6','#2f9e8f','#e8912d','#3b82c4','#c2410c','#0f766e','#a21caf'];
let KIDS=(()=>{try{const f=JSON.parse(localStorage.getItem('bny-fam')||'null');if(f&&f.length)return f}catch{}return [['לינוי','#e0527a'],['רומי','#8e5bd6'],['אלין','#2f9e8f'],['גיל','#e8912d'],['אדוה','#3b82c4']]})();
const kidColor=n=>(KIDS.find(k=>k[0]===n)||[])[1]||'#888';
const kidBg=ks=>!ks.length?'var(--g)':ks.length===1?kidColor(ks[0]):`linear-gradient(135deg,${ks.map(kidColor).join(',')})`;
function setFamily(users){
  FAMU=users;localStorage.setItem('bny-famfull',JSON.stringify(users));
  const sorted=[...users].sort((x,y)=>(x.p?1:0)-(y.p?1:0));
  KIDS=sorted.map((u,i)=>[u.n,u.c||PALETTE[i%PALETTE.length]]);
  localStorage.setItem('bny-fam',JSON.stringify(KIDS));
  kidsBuilt=false;renderKids();renderCal();renderContacts();
}
let famTick=0;
async function loadFamily(){try{const r=await fetch('/api/users',{headers:hdr()});if(r.ok)setFamily((await r.json()).users)}catch{}}
let kidFilter='';
const evKids=e=>e.kids&&e.kids.length?e.kids:(e.kid?[e.kid]:[]);
const kidTags=ks=>ks.map(k=>`<span class="tag" style="--c:${kidColor(k)}">${esc(k)}</span>`).join('');
let adminTok=localStorage.getItem('bny-admin')||'';
let syncT;
db.events.forEach(e=>{if(!e.at)e.at=new Date(`${e.date}T${e.time}`).getTime()});
// שינוי שם: אדה -> אדוה (נתונים קיימים)
db.events.forEach(e=>{if(e.kid==='אדה')e.kid='אדוה'});db.tasks.forEach(t=>{if(t.who==='אדה')t.who='אדוה'});
db.contacts.forEach(c=>{if((c.kids||[]).includes('אדה'))c.kids=c.kids.map(k=>k==='אדה'?'אדוה':k)});
// העברת הערות ישנות אל איש הקשר
if(!db.notesMigrated){for(const n of db.notes){if(n.del||!n.contact)continue;const c=db.contacts.find(c=>c.id===n.contact);if(c&&!(c.info||'').includes(n.text||'')){c.info=((c.info?c.info+'\n':'')+(n.title?n.title+': ':'')+(n.text||'')).trim();c.u=Date.now()}}db.notesMigrated=1}
const save=()=>{localStorage.setItem(KEY,JSON.stringify(db));clearTimeout(syncT);syncT=setTimeout(sync,600)};
const touch=o=>{o.u=Date.now();return o};
const live=a=>a.filter(x=>!x.del);
const uid=()=>Date.now().toString(36)+Math.random().toString(36).slice(2,6);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const pad=n=>String(n).padStart(2,'0');
const iso=d=>`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
const fmtDate=s=>new Date(s+'T00:00').toLocaleDateString('he-IL',{weekday:'long',day:'numeric',month:'long'});
function toast(t){const e=$('#toast');e.textContent=t;e.hidden=false;setTimeout(()=>e.hidden=true,2200)}

// tabs
let curTab='home';
function showTab(t){curTab=t;$$('.tabs button').forEach(x=>x.classList.toggle('on',x.dataset.t===t));$$('.tab').forEach(x=>x.classList.toggle('active',x.id==='tab-'+t));if(typeof renderKids==='function')renderKids();scrollTo({top:0})}
$$('.tabs button').forEach(b=>b.onclick=()=>showTab(b.dataset.t));
function tick(){const d=new Date();
  $('#clock').textContent=d.toLocaleTimeString('he-IL',{hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false});
  $('#dateLine').textContent=d.toLocaleDateString('he-IL',{weekday:'long',day:'numeric',month:'long',year:'numeric'});}
function renderToday(){
  const d=new Date(),h=d.getHours();
  $('#greet').textContent=(h<5?'לילה טוב':h<12?'בוקר טוב':h<18?'צהריים טובים':h<22?'ערב טוב':'לילה טוב')+(myName?', '+myName+' 👋':' משפחת בן יהודה');
  const t=iso(d),hm=`${pad(h)}:${pad(d.getMinutes())}`;
  const ev=live(db.events).filter(e=>REC.occursOn(e,t)).sort((a,b)=>REC.timeOn(a,t).localeCompare(REC.timeOn(b,t)));
  const nxt=ev.find(e=>REC.timeOn(e,t)>=hm);
  $('#todaySum').textContent=ev.length?`היום ${ev.length} אירועים`+(nxt?` · הבא: ${nxt.title} ב־${REC.timeOn(nxt,t)}`:''):'';
}
tick();setInterval(tick,1000);setInterval(()=>{renderToday();renderKids()},30000);
let kidsBuilt=false;
function renderKids(){
  if(kidsBuilt)return;kidsBuilt=true;
  const opts='<option value="">כולם</option>'+KIDS.map(k=>`<option>${k[0]}</option>`).join('');
  $('#kidChecks').innerHTML=KIDS.map(([n,c])=>`<label class="ck" style="--c:${c}"><input type="checkbox" name="kids" value="${n}"><span>${n}</span></label>`).join('');
  $('#evKids').innerHTML=KIDS.map(([n,c])=>`<label class="ck" style="--c:${c}"><input type="checkbox" name="ekids" value="${n}"><span>${n}</span></label>`).join('');
  $('#whoSel').innerHTML=opts;
}

// sheet
function sheet(title,html){$('#sheetTitle').textContent=title;$('#sheetBody').innerHTML=html;$('#sheet').hidden=false}
$('#sheetClose').onclick=()=>$('#sheet').hidden=true;
$('#sheet').onclick=e=>{if(e.target.id==='sheet')e.target.hidden=true};
const waze=a=>`https://waze.com/ul?q=${encodeURIComponent(a)}&navigate=yes`;
const intl=p=>{p=p.replace(/[^\d+]/g,'');return p.startsWith('+')?p.slice(1):p.replace(/^0/,'972')};

// tasks
let tf='open';
$('#taskFilters').onclick=e=>{const f=e.target.dataset.f;if(!f)return;tf=f;$$('#taskFilters button').forEach(b=>b.classList.toggle('on',b.dataset.f===f));renderTasks()};
$('#taskForm').onsubmit=e=>{e.preventDefault();const f=new FormData(e.target);db.tasks.unshift(touch({id:uid(),title:f.get('title'),who:f.get('who'),due:f.get('due'),done:false}));save();e.target.reset();renderTasks()};
function renderTasks(){
  const today=iso(new Date());
  const l=live(db.tasks).filter(t=>tf==='all'||(tf==='done')===t.done);
  $('#taskList').innerHTML=l.length?l.map(t=>`<li class="item ${t.done?'done':''} ${!t.done&&t.due&&t.due<today?'late':''}" style="--c:${t.who?kidColor(t.who):'var(--b1)'}"><button class="check" data-id="${t.id}" data-a="tog">${t.done?'✓':''}</button><div class="main"><b>${esc(t.title)}</b><small>${t.who?`<span class="tag" style="--c:${kidColor(t.who)}">${esc(t.who)}</span> `:''}<small class="d">${t.due?'📅 '+fmtDate(t.due):''}</small></small></div><button class="del" data-id="${t.id}" data-a="del">🗑</button></li>`).join(''):'<li class="empty">אין משימות 🎉</li>';
  renderCal();
}
$('#taskList').onclick=e=>{const b=e.target.closest('button');if(!b)return;const t=db.tasks.find(x=>x.id===b.dataset.id);if(b.dataset.a==='tog')touch(t).done=!t.done;else if(confirm('למחוק?')){t.del=1;touch(t)}save();renderTasks()};

// calendar
let view=new Date(),sel=iso(new Date());view.setDate(1);
function renderCal(){
  const y=view.getFullYear(),m=view.getMonth(),today=iso(new Date());
  $('#monthLabel').textContent=view.toLocaleDateString('he-IL',{month:'long',year:'numeric'});
  const start=new Date(y,m,1-new Date(y,m,1).getDay());
  const evs=live(db.events);let h='';
  for(let i=0;i<42;i++){const d=new Date(start);d.setDate(start.getDate()+i);const k=iso(d);
    const items=evs.filter(e=>REC.occursOn(e,k)).sort((p,q)=>p.time.localeCompare(q.time)).map(e=>({t:(e.req?'❗ ':'')+e.title,bg:evKids(e).length?kidBg(evKids(e)):'#f0a92b'}));
    if(adminTok)live(db.tasks).filter(t=>t.due===k&&!t.done).forEach(t=>items.push({t:'☐ '+t.title,bg:'#8a8aa5'}));
    const shown=items.slice(0,3).map(x=>`<i style="background:${x.bg}">${esc(x.t)}</i>`).join('')+(items.length>3?`<i class="more">+${items.length-3}</i>`:'');
    h+=`<button class="day ${d.getMonth()!==m?'out':''} ${k===today?'today':''} ${k===sel?'sel':''}" data-d="${k}"><span class="dn">${d.getDate()}</span><span class="dt">${shown}</span></button>`}
  $('#days').innerHTML=h;
  $('#selLabel').textContent=fmtDate(sel);
  const ev=evs.filter(e=>REC.occursOn(e,sel)).sort((a,b)=>REC.timeOn(a,sel).localeCompare(REC.timeOn(b,sel)));
  $('#eventList').innerHTML=ev.length?ev.map(e=>`<li class="item" style="--c:${evKids(e).length?kidColor(evKids(e)[0]):'var(--b1)'}"><div class="avatar" style="background:${kidBg(evKids(e))}">${esc(REC.timeOn(e,sel))}</div><div class="main"><b>${esc(e.title)}${kidTags(evKids(e))}</b><small>${e.req?'❗ דורש אישור ביצוע · ':''}${e.rep?'🔁 '+repText(e)+(e.until?' עד '+e.until:'')+' · ':''}${e.nag?'🔂 כל '+e.nag+' דק׳ · ':''}${e.remind>=0?'🔔 '+$('#eventForm [name=remind] option[value="'+e.remind+'"]').textContent:'ללא תזכורת'}</small></div>${e.img?`<img class="evImg" data-img="${e.img}" alt="תמונה">`:''}${adminTok?`<button class="share" data-ed="${e.id}" title="עריכה">✏️</button>`:''}<button class="share" data-s="${e.id}" title="שלח תזכורת">📤</button><button class="del" data-id="${e.id}">🗑</button></li>`).join(''):'<li class="empty">אין אירועים ביום זה</li>';
  const tk=adminTok?live(db.tasks).filter(t=>t.due===sel):[];
  $('#dayTasksH').hidden=!tk.length;
  $('#dayTasks').innerHTML=tk.map(t=>`<li class="item ${t.done?'done':''}" style="--c:${t.who?kidColor(t.who):'var(--b1)'}"><div class="avatar">${t.done?'✓':'☐'}</div><div class="main"><b>${esc(t.title)}${t.who?`<span class="tag" style="--c:${kidColor(t.who)}">${esc(t.who)}</span>`:''}</b></div></li>`).join('');
  if($('#eventModal').hidden)$('#eventForm [name=date]').value=sel;
  renderAdminEvents();hydrateImgs();renderToday();renderKids();
}
$('#days').onclick=e=>{const d=e.target.closest('.day');if(!d)return;sel=d.dataset.d;$('#eventForm [name=date]').value=sel;const s=new Date(sel+'T00:00');view=new Date(s.getFullYear(),s.getMonth(),1);renderCal()};
$('#prevM').onclick=()=>{view.setMonth(view.getMonth()-1);renderCal()};
$('#nextM').onclick=()=>{view.setMonth(view.getMonth()+1);renderCal()};
$('#goToday').onclick=()=>{sel=iso(new Date());view=new Date();view.setDate(1);renderCal()};
$('#eventForm').onsubmit=async e=>{e.preventDefault();const f=new FormData(e.target);let imgId=curImg;
  if(pendingImg){try{const r=await fetch('/api/image',{method:'POST',headers:hdr(),body:JSON.stringify({data:pendingImg})});if(r.ok)imgId=(await r.json()).id;else toast('העלאת התמונה נכשלה')}catch{toast('העלאת התמונה נכשלה')}}
  if(origImg&&imgId!==origImg)fetch('/api/image?id='+origImg,{method:'DELETE',headers:hdr()}).catch(()=>{});
  const tm=f.get('time')||'00:00',rep=f.get('rep')||'';let saved=null;
  const days=rep==='dow'?f.getAll('days').map(Number):[];
  if(rep==='dow'&&!days.length){toast('סמן לפחות יום אחד בשבוע');return}
  const dt={};for(const d of days)if(curDT[d]&&curDT[d]!==tm)dt[d]=curDT[d];
  const data={days:rep==='dow'?days:null,dtimes:rep==='dow'&&Object.keys(dt).length?dt:null,req:!!f.get('req'),title:f.get('title'),date:f.get('date'),time:tm,kids:f.getAll('ekids'),img:imgId,rep,nag:+f.get('nag')||0,until:rep?(f.get('until')||''):'',at:new Date(`${f.get('date')}T${tm}`).getTime(),remind:+f.get('remind')};
  if(editEv){const x=db.events.find(v=>v.id===editEv);if(x){Object.assign(x,data);delete x.kid;touch(x)}}else{saved=touch({id:uid(),...data});db.events.push(saved)}
  sel=f.get('date');save();editEv='';clearImg();$('#eventModal').hidden=true;renderCal();checkReminders();
  if(saved&&f.get('wa'))setTimeout(()=>shareEvent(saved),300);
  e.target.wa.checked=false;
  if(+f.get('remind')>=0&&Notification.permission==='default')askNotif()};
function shareEvent(ev){
  const ek=evKids(ev);const txt=`תזכורת: ${ev.title}${ek.length?' ('+ek.join(', ')+')':''} – ${fmtDate(ev.date)} בשעה ${ev.time}`;
  const q=encodeURIComponent(txt);
  const cs=live(db.contacts).filter(c=>(c.phone||c.email)&&(!ek.length||!(c.kids||[]).length||ek.some(k=>(c.kids||[]).includes(k))));
  let h=`<p class="mut" style="margin-bottom:12px">${esc(txt)}</p>`;
  h+=`<a class="act wa" href="https://wa.me/?text=${q}" target="_blank" rel="noopener">🟢 <span><b>שלח בוואטסאפ לקבוצה / לאדם</b><br><small>בחר בוואטסאפ למי לשלוח</small></span></a>`;
  h+=cs.map(c=>`<div class="act" style="flex-wrap:wrap"><b style="flex:1;min-width:90px">${esc(c.name)}</b>${c.phone?`<a class="miniWa" href="https://wa.me/${intl(c.phone)}?text=${q}" target="_blank" rel="noopener">🟢 וואטסאפ</a><a href="sms:${esc(c.phone)}?&body=${q}">💬</a>`:''}${c.email?`<a href="mailto:${esc(c.email)}?subject=${encodeURIComponent('תזכורת: '+ev.title)}&body=${q}">✉️</a>`:''}</div>`).join('');
  sheet('שליחת תזכורת',h);
}
$('#eventList').onclick=e=>{const im=e.target.closest('.evImg');if(im)return showImage(im.dataset.img);const ed=e.target.closest('[data-ed]');if(ed)return openEventForm(db.events.find(x=>x.id===ed.dataset.ed));const s=e.target.closest('.share');if(s)return shareEvent(db.events.find(x=>x.id===s.dataset.s));const b=e.target.closest('.del');if(b&&confirm((db.events.find(x=>x.id===b.dataset.id)||{}).rep?'למחוק את כל האירועים החוזרים של האירוע הזה?':'למחוק?')){const x=db.events.find(x=>x.id===b.dataset.id);x.del=1;touch(x);if(x.img)fetch('/api/image?id='+x.img,{method:'DELETE',headers:hdr()}).catch(()=>{});save();renderCal()}};

// reminders (שרת-פוש חיצוני אינו נדרש: התראות מקומיות בכל מכשיר שבו האפליקציה מותקנת)
// צלילי התראה לבחירה (מושמעים כשהאפליקציה פתוחה; כשהיא סגורה הצליל נקבע בהגדרות הטלפון)
// צליל התראה: צליל הודעה מודרני ועדין (שלושה צלילים עולים, קצת "זכוכית" והד קצר)
const GLASS=[[1,1],[2,.28],[3,.1],[4.1,.04]];
const TONES={
  sms:['הצליל שלי – SMS 💬',[],'sine',[[1,1]],1,false,'/sounds/sms.mp3'],
  msg:["הודעה חדשה ✨",[[659, 0, 0.55], [988, 0.11, 0.6], [1319, 0.24, 1.1]],'sine',[[1, 1], [2, 0.28], [3, 0.1], [4.1, 0.04]],0.34,true],
  bubble:["בועה 🫧",[[520, 0, 0.16, 1040], [700, 0.14, 0.18, 1400], [880, 0.3, 0.3, 1760]],'sine',[[1, 1], [2, 0.15]],0.4,false],
  drop:["טיפה 💧",[[1760, 0, 0.45, 1100], [1320, 0.32, 0.5, 880]],'sine',[[1, 1], [2, 0.2]],0.36,true],
  bell:["פעמון רך 🔔",[[988, 0, 1.2], [1480, 0.2, 1.4]],'sine',[[1, 1], [2.76, 0.28], [5.4, 0.1]],0.3,true],
  doorbell:["פעמון דלת 🚪",[[659, 0, 0.9], [523, 0.45, 1.4]],'sine',[[1, 1], [2, 0.3], [3, 0.1]],0.36,true],
  sparkle:["נצנוץ ✨",[[1319, 0, 0.35], [1568, 0.07, 0.35], [1976, 0.14, 0.35], [2349, 0.21, 0.35], [2637, 0.28, 0.8]],'sine',[[1, 1], [2, 0.2]],0.26,true],
  harp:["נבל 🎶",[[523, 0, 0.9], [659, 0.09, 0.9], [784, 0.18, 0.9], [1046, 0.27, 0.9], [1318, 0.36, 1.2]],'triangle',[[1, 1], [2, 0.35], [3, 0.15]],0.3,false],
  marimba:["מרימבה 🥁",[[784, 0, 0.3], [988, 0.14, 0.3], [1318, 0.28, 0.3], [1568, 0.42, 0.55]],'sine',[[1, 1], [4, 0.22]],0.4,false],
  silent:['שקט (בלי צליל)',[],'sine',[[1,1]],0]
};
let tone=localStorage.getItem('bny-tone');if(!TONES[tone])tone='sms';
let AC;function ctx(){AC=AC||new (window.AudioContext||window.webkitAudioContext)();if(AC.state==='suspended')AC.resume();return AC}
['pointerdown','touchstart','keydown'].forEach(ev=>addEventListener(ev,()=>{try{ctx()}catch{}},{once:true,passive:true}));
let vol=parseFloat(localStorage.getItem('bny-vol')||'1');if(!(vol>0&&vol<=1))vol=1;
const toneBufs={};
async function playFile(url){
  const c=ctx(),master=c.createGain(),comp=c.createDynamicsCompressor();master.gain.value=Math.min(1,vol);comp.threshold.value=-1;comp.knee.value=0;comp.ratio.value=20;master.connect(comp);comp.connect(c.destination);
  try{if(!toneBufs[url])toneBufs[url]=await c.decodeAudioData(await (await fetch(url)).arrayBuffer());
    const src=c.createBufferSource();src.buffer=toneBufs[url];src.connect(master);src.start()}
  catch{try{const au=new Audio(url);au.volume=Math.min(1,vol);au.play()}catch{}}
}
function playTone(name){try{const t=TONES[name]||TONES.msg;if(t[6]){playFile(t[6]);return}if(!t[1].length)return;
  const c=ctx(),master=c.createGain(),comp=c.createDynamicsCompressor();master.gain.value=vol*3;comp.threshold.value=-4;comp.knee.value=0;comp.ratio.value=20;comp.attack.value=0;comp.release.value=.15;master.connect(comp);comp.connect(c.destination);
  let echo=null;
  if(t[5]){echo=c.createDelay(.6);echo.delayTime.value=.22;const fb=c.createGain();fb.gain.value=.32;const wet=c.createGain();wet.gain.value=.5;echo.connect(fb);fb.connect(echo);echo.connect(wet);wet.connect(master)}
  t[1].forEach(([f,at,dur,f2])=>{for(const [mult,amp] of t[3]){const o=c.createOscillator(),g=c.createGain();o.type=t[2];o.connect(g);g.connect(master);if(echo)g.connect(echo);
    const s=c.currentTime+at;o.frequency.setValueAtTime(f*mult,s);if(f2)o.frequency.exponentialRampToValueAtTime(f2*mult,s+dur*.7);
    const v=Math.min(.95,t[4]*3*amp/(mult>1?1.2:1));g.gain.setValueAtTime(.0001,s);g.gain.exponentialRampToValueAtTime(v,s+.015);g.gain.exponentialRampToValueAtTime(.0001,s+dur);o.start(s);o.stop(s+dur+.05)}})}catch{}}
function beep(){playTone(tone)}
async function notify(title,body){
  toast('🔔 '+title);
  if(!('Notification' in window)||Notification.permission!=='granted')return;
  showAlarm({t:title,b:body});try{const r=await navigator.serviceWorker.ready;await r.showNotification(title,{body,icon:'icons/icon-192.png',dir:'rtl',lang:'he',tag:title+body,renotify:true,silent:false,requireInteraction:true,vibrate:[300,150,300,150,300]})}catch{new Notification(title,{body})}
}
function checkReminders(){
  const now=Date.now();let ch=false;
  if(pushOn)return;
  const dd=n=>iso(new Date(now+n*864e5));
  for(const e of live(db.events)){if(!(e.remind>=0))continue;
    for(const d of [dd(-1),dd(0),dd(1)]){if(!REC.occursOn(e,d))continue;
      const at=new Date(`${d}T${REC.timeOn(e,d)}`).getTime(),fire=at-e.remind*60000,key=e.id+':'+at;
      if(now>=fire&&now<at+3600000&&!db.fired[key]){db.fired[key]=1;ch=true;
        const ks=evKids(e);notify('תזכורת: '+e.title+(ks.length?' ('+ks.join(', ')+')':''),`${fmtDate(d)} בשעה ${REC.timeOn(e,d)}`)}}}
  const today=iso(new Date());
  if(!db.fired['d'+today]&&new Date().getHours()>=8){const n=!adminTok?0:live(db.tasks).filter(t=>!t.done&&t.due&&t.due<=today).length;
    if(n){db.fired['d'+today]=1;ch=true;notify('משימות להיום',`יש ${n} משימות פתוחות להיום או באיחור`)}}
  if(ch)save();
}
function askNotif(){if(!('Notification' in window))return toast('הדפדפן לא תומך בהתראות');Notification.requestPermission().then(()=>{updNotifBtn();enablePush(true)})}
let pushOn=localStorage.getItem('bny-push')==='1';
const b64=s=>{s=(s+'='.repeat((4-s.length%4)%4)).replace(/-/g,'+').replace(/_/g,'/');return Uint8Array.from(atob(s),c=>c.charCodeAt(0))};
const hdr=()=>({'x-token':token,'x-admin-code':adminTok,'content-type':'application/json'});
async function enablePush(verbose){
  if(inApp())return false; // inside the Android app, reminders come through the native alarm
  const say=m=>{if(verbose)toast(m)};
  try{
    if(!('serviceWorker' in navigator)||!('PushManager' in window)){say('המכשיר/הדפדפן לא תומך בהתראות. באייפון: הוסף למסך הבית ופתח משם');return false}
    if(Notification.permission!=='granted'){say('ההתראות לא אושרו במכשיר');return false}
    if(!token){say('יש להתחבר קודם');return false}
    const kr=await fetch('/api/subscribe',{headers:hdr()});const {key}=await kr.json();
    if(!key){say('שגיאת שרת: חסר מפתח התראות');return false}
    const reg=await navigator.serviceWorker.ready;
    const sub=(await reg.pushManager.getSubscription())||await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:b64(key)});
    const r=await fetch('/api/subscribe',{method:'POST',headers:hdr(),body:JSON.stringify(sub)});
    if(!r.ok){say('שמירת הרישום בשרת נכשלה');return false}
    pushOn=true;localStorage.setItem('bny-push','1');updNotifBtn();say('ההתראות הופעלו במכשיר ✔');return true
  }catch(e){say('שגיאה בהפעלת התראות: '+(e.message||e));return false}
}
let syncing=false;
async function sync(){
  if(syncing)return;
  if(!token){showLogin();return}
  syncing=true;
  try{
    const {tasks,events,contacts,notes}=db;
    const body=adminTok?{tasks,events,contacts,notes}:{events};const cmp=adminTok?body:{events,contacts,notes};
    const r=await fetch('/api/data',{method:'POST',headers:hdr(),body:JSON.stringify(body)});
    if(r.status===401){logout(true);return}
    if(!r.ok)return;
    const m=await r.json();
    if(JSON.stringify(cmp)!==JSON.stringify(m)){Object.assign(db,m);localStorage.setItem(KEY,JSON.stringify(db));renderAll()}
    enablePush();
    pingCron();
    if(famTick++%10===0)loadFamily();
    if(famTick===1)linkNative();
    loadPending();
  }catch(e){}finally{syncing=false}
}
setInterval(()=>{if(!document.hidden)sync()},30000);
addEventListener('online',sync);
function updNotifBtn(){const b=$('#notifBtn');b.hidden=inApp()||!('Notification' in window)||(Notification.permission==='granted'&&localStorage.getItem('bny-push')==='1')}
$('#notifBtn').onclick=askNotif;
setInterval(checkReminders,30000);document.addEventListener('visibilitychange',checkReminders);

// contacts
function renderContacts(){
  const q=$('#search').value.trim().toLowerCase();
  const l=live(db.contacts).filter(c=>(!kidFilter||(c.kids||[]).includes(kidFilter))&&(!q||(c.name+c.phone+c.address+(c.email||'')).toLowerCase().includes(q))).sort((a,b)=>a.name.localeCompare(b.name,'he'));
  renderAdminContacts();
  $('#contactList').innerHTML=l.length?l.map(c=>`<li class="item" data-id="${c.id}"><div class="avatar">${esc(c.name[0])}</div><div class="main"><b>${esc(c.name)}</b><small>${esc(c.phone)} ${c.note?'· '+esc(c.note):''}</small>${c.info?`<p class="info">📝 ${esc(c.info)}</p>`:''}<div>${(c.kids||[]).map(k=>`<span class="tag" style="--c:${kidColor(k)}">${esc(k)}</span>`).join('')}</div>${c.address?`<br><button class="addr" data-w="${c.id}">📍 ${esc(c.address)}</button>`:''}</div>${c.address?`<button class="wazeBtn" data-w="${c.id}" aria-label="Waze">🚗<span>Waze</span></button>`:''}</li>`).join(''):'<li class="empty">אין אנשי קשר</li>';
}
$('#search').oninput=renderContacts;
let editId='';
function endEdit(){editId='';$('#contactForm').reset();$('#contactForm h3').textContent='איש קשר חדש';$('#contactSave').textContent='＋ שמור';$('#contactModal').hidden=true}
function openContactForm(){$('#contactModal').hidden=false}
$('#addContactBtn').onclick=()=>{editId='';$('#contactForm').reset();$('#contactForm h3').textContent='איש קשר חדש';$('#contactSave').textContent='＋ שמור';openContactForm();setTimeout(()=>$('#contactForm [name=name]').focus(),50)};
$('#contactModal').onclick=e=>{if(e.target.id==='contactModal')endEdit()};
function editContact(c){editId=c.id;const f=$('#contactForm');
  for(const k of ['name','phone','email','address','note','info'])f.elements[k].value=c[k]||'';
  $$('#kidChecks input').forEach(i=>i.checked=(c.kids||[]).includes(i.value));
  f.querySelector('h3').textContent='עריכת איש קשר';$('#contactSave').textContent='שמור שינויים';openContactForm();}
$('#contactCancel').onclick=endEdit;
$('#contactForm').onsubmit=e=>{e.preventDefault();const fd=new FormData(e.target);const f=Object.fromEntries(fd);delete f.kids;f.kids=fd.getAll('kids');
  if(editId){const c=db.contacts.find(c=>c.id===editId);Object.assign(c,f);touch(c)}else db.contacts.push(touch({id:uid(),...f}));
  save();endEdit();renderContacts()};
$('#contactList').onclick=e=>{
  const x=e.target.closest('[data-x]');if(x){if(confirm('למחוק?')){const c=db.contacts.find(c=>c.id===x.dataset.x);c.del=1;touch(c);save();renderContacts()}return}
  const w=e.target.closest('[data-w]');if(w){const c=db.contacts.find(c=>c.id===w.dataset.w);open(waze(c.address),'_blank');return}
  const it=e.target.closest('.item');if(!it)return;const c=db.contacts.find(c=>c.id===it.dataset.id);
  let h=c.address?`<a class="act waze" href="${waze(c.address)}" target="_blank" rel="noopener">🚗 <span><b>נווט ב-Waze</b><br><small>${esc(c.address)}</small></span></a>`:`<div class="act" style="opacity:.7">📍 אין כתובת – לחץ "ערוך" כדי להוסיף</div>`;
  if(c.info)h+=`<div class="act info2">📝 <span>${esc(c.info)}</span></div>`;
  if(c.phone)h+=`<a class="act" href="tel:${esc(c.phone)}">📞 התקשר ${esc(c.phone)}</a><a class="act" href="sms:${esc(c.phone)}">💬 שלח SMS</a><a class="act" href="https://wa.me/${intl(c.phone)}" target="_blank">🟢 וואטסאפ</a>`;
  if(c.email)h+=`<a class="act" href="mailto:${esc(c.email)}">✉️ שלח מייל ${esc(c.email)}</a>`;
  if(adminTok)h+=`<button class="act" data-edit="${c.id}">✏️ ערוך איש קשר</button>`;
  sheet(c.name,h);
  const eb=$('#sheetBody [data-edit]');if(eb)eb.onclick=()=>{$('#sheet').hidden=true;editContact(c)};
};


function renderAdmin(){const on=!!adminTok;$('#adminGate').hidden=on;if(on)$('#otpForm').hidden=true;$('#adminBody').hidden=!on;renderContacts();renderCal();if(on){renderTasks();loadUsers()}}
async function requestOtp(){
  try{const r=await fetch('/api/otp',{method:'POST',headers:hdr(),body:JSON.stringify({action:'request'})});
    if(r.status===429){toast('יותר מדי בקשות, נסה בעוד כמה דקות');return false}
    if(!r.ok){toast('שליחת המייל נכשלה');return false}
    toast('הקוד נשלח למייל המנהל');return true}catch{toast('אין חיבור לשרת');return false}}
async function verifyOtp(code){
  try{const r=await fetch('/api/otp',{method:'POST',headers:hdr(),body:JSON.stringify({action:'verify',code})});
    if(!r.ok){toast('קוד שגוי או שפג תוקפו');return null}
    return await r.json()}catch{toast('אין חיבור לשרת');return null}}
$('#sendOtp').onclick=async()=>{if(await requestOtp())$('#otpForm').hidden=false};
$('#otpForm').onsubmit=async e=>{e.preventDefault();const t=await verifyOtp(e.target.code.value);if(!t)return;
  adminTok=t.token;localStorage.setItem('bny-admin',adminTok);e.target.reset();renderAdmin();sync()};
$('#lockBtn').onclick=()=>{adminTok='';localStorage.removeItem('bny-admin');renderAdmin()};
// users + password (manager)
async function usersCall(body){
  const r=await fetch('/api/users',{method:body?'POST':'GET',headers:hdr(),body:body?JSON.stringify(body):undefined});
  if(!r.ok){toast(r.status===401?'אין הרשאת מנהל':'שגיאה');return null}return r.json()}
async function loadUsers(){const d=await usersCall();if(d)renderUsers(d.users)}
function renderUsers(us){$('#userList').innerHTML=us.map((u,i)=>`<li class="item" style="--c:${u.c||PALETTE[i%PALETTE.length]}"><input type="color" class="colorPick" data-uc="${esc(u.u)}" data-n="${esc(u.n)}" data-p="${u.p?1:''}" value="${u.c||PALETTE[i%PALETTE.length]}" aria-label="צבע"><div class="main"><b>${esc(u.n)}</b><small dir="ltr">${esc(u.u)}${u.p?' · הורה':''}</small></div><button class="del" data-u="${esc(u.u)}">🗑</button></li>`).join('')}
$('#userList').onclick=async e=>{const b=e.target.closest('[data-u]');if(!b||!confirm('להסיר את המשתמש?'))return;const d=await usersCall({action:'remove',u:b.dataset.u});if(d)renderUsers(d.users)};
$('#userForm').onsubmit=async e=>{e.preventDefault();const f=Object.fromEntries(new FormData(e.target));f.p=!!f.p;const d=await usersCall({action:'save',...f});if(d){renderUsers(d.users);e.target.reset();toast('נשמר')}};
$('#pwForm').onsubmit=async e=>{e.preventDefault();const d=await usersCall({action:'password',password:e.target.pw.value});if(d){e.target.reset();toast('הסיסמה שונתה – כולם יתחברו מחדש')}};
// login screen
function showLogin(){$('#login').hidden=false;$('#meBtn').hidden=true}
function renderMe(){const b=$('#meBtn');b.hidden=!(token||myName);b.textContent='👤 '+(myName||'')}
function logout(expired){token='';adminTok='';myName='';myUser='';['bny-token','bny-admin','bny-name','bny-user'].forEach(k=>localStorage.removeItem(k));renderAdmin();renderToday();showLogin();if(expired)toast('יש להתחבר מחדש')}
function loggedIn(t,name,uname){token=t;myName=name;myUser=uname||'admin';setTimeout(linkNative,500);localStorage.setItem('bny-token',t);localStorage.setItem('bny-name',name);localStorage.setItem('bny-user',myUser);$('#login').hidden=true;renderMe();renderToday();sync()}
$('#loginFormMain').onsubmit=async e=>{e.preventDefault();const f=Object.fromEntries(new FormData(e.target));
  try{const r=await fetch('/api/login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(f)});
    if(r.status===429)return toast('יותר מדי ניסיונות, נסה בעוד כמה דקות');
    if(!r.ok)return toast('שם משתמש או סיסמה שגויים');
    const d=await r.json();e.target.reset();loggedIn(d.token,d.name,d.username)}catch{toast('אין חיבור לשרת')}};
$('#mgrBtn').onclick=async()=>{if(await requestOtp())$('#loginOtp').hidden=false};
$('#loginOtp').onsubmit=async e=>{e.preventDefault();const t=await verifyOtp(e.target.code.value);if(!t)return;
  adminTok=t.token;localStorage.setItem('bny-admin',adminTok);e.target.reset();e.target.hidden=true;renderAdmin();loggedIn(t.token,'מנהל')};
$('#meBtn').onclick=()=>{if(!token){logout();return}sheet(myName||'משתמש',`<label class="lbl">🎵 צלצול התראה (כשהאפליקציה פתוחה)</label><div class="row" style="margin-bottom:10px"><select id="toneSel">${Object.entries(TONES).map(([k,v])=>`<option value="${k}" ${k===tone?'selected':''}>${v[0]}</option>`).join('')}</select><button class="btn" id="toneTry" style="flex:none">▶ השמע</button></div><label class="lbl" style="flex-direction:row;gap:8px;align-items:center;margin-bottom:10px;color:var(--text)"><input type="checkbox" id="loopChk" ${localStorage.getItem('bny-loop')!=='0'?'checked':''} style="width:auto"> צלצול מתמשך עד שלוחצים "הבנתי"</label><label class="lbl" style="margin-bottom:10px">🔊 עוצמת הצלצול<input type="range" id="volRange" min="20" max="100" step="10" value="${Math.round(vol*100)}" style="padding:0"></label><p class="mut" style="margin-bottom:10px;font-size:12px">כשהאפליקציה סגורה, הצליל נקבע בהגדרות ההתראות של הטלפון.</p>${inApp()?'':`<button class="act" id="testPush">🔔 שלח לי התראת בדיקה</button>`}${inApp()?`<button class="act" id="updBtn">🔄 עדכון האפליקציה (גרסה ${esc(window.AndroidBridge.version?window.AndroidBridge.version():'')})</button>`:''}<button class="act" id="appBtn">📲 אפליקציית אנדרואיד – מסך מלא גם כשסגור</button>${inApp()?'':`<button class="act" id="diagBtn">🩺 בדיקת התראות במכשיר</button>`}<button class="act" id="logoutBtn">🚪 התנתק</button>`);
  $('#volRange').onchange=e=>{vol=e.target.value/100;localStorage.setItem('bny-vol',String(vol));playTone(tone)};{const e=$('#testPush');if(e)e.onclick=testPush}{const e=$('#diagBtn');if(e)e.onclick=diagnose}$('#appBtn').onclick=appSetup;{const e=$('#updBtn');if(e)e.onclick=()=>{toast('מוריד גרסה חדשה – אחרי ההורדה לחצו עליה ואשרו התקנה');try{window.AndroidBridge.update()}catch{}}}$('#loopChk').onchange=e=>localStorage.setItem('bny-loop',e.target.checked?'1':'0');$('#toneSel').onchange=e=>{tone=e.target.value;localStorage.setItem('bny-tone',tone);syncNativeSound();playTone(tone)};$('#toneTry').onclick=()=>playTone($('#toneSel').value);$('#logoutBtn').onclick=()=>{$('#sheet').hidden=true;logout()}};
function renderAll(){renderToday();renderKids();renderAdmin();renderCal();renderContacts()}
renderAll();renderMe();updNotifBtn();checkReminders();sync();
if('serviceWorker' in navigator)navigator.serviceWorker.register('sw.js').catch(()=>{});

// התקנה כאפליקציה (אנדרואיד / אייפון)
const standalone=matchMedia('(display-mode: standalone)').matches||navigator.standalone;
const isIOS=/iphone|ipad|ipod/i.test(navigator.userAgent);
let installEv=null;
addEventListener('beforeinstallprompt',e=>{e.preventDefault();installEv=e;if(!standalone)$('#installBtn').hidden=false});
if(isIOS&&!standalone)$('#installBtn').hidden=false;
$('#installBtn').onclick=async()=>{
  if(installEv){installEv.prompt();await installEv.userChoice;installEv=null;$('#installBtn').hidden=true}
  else if(isIOS){const t=$('#iosHint');t.hidden=false;setTimeout(()=>t.hidden=true,7000)}
};
addEventListener('appinstalled',()=>$('#installBtn').hidden=true);

async function testPush(){
  if(!(await enablePush(true)))return;
  try{
    const sub=await (await navigator.serviceWorker.ready).pushManager.getSubscription();
    const r=await fetch('/api/subscribe',{method:'POST',headers:hdr(),body:JSON.stringify({test:true,endpoint:sub.endpoint})});
    const d=await r.json().catch(()=>({}));
    if(r.ok)toast('נשלחה התראת בדיקה – אמורה להופיע תוך שניות');else toast('השרת לא הצליח לשלוח: '+(d.error||r.status));
  }catch(e){toast('שגיאה: '+(e.message||e))}
}

$('#repSel').onchange=e=>{$('#untilWrap').hidden=!e.target.value;$('#dowBox').hidden=e.target.value!=='dow'};

function renderAdminContacts(){
  const l=live(db.contacts).sort((x,y)=>x.name.localeCompare(y.name,'he'));
  $('#adminContacts').innerHTML=l.length?l.map(c=>`<li class="item"><div class="avatar">${esc(c.name[0])}</div><div class="main"><b>${esc(c.name)}</b><small>${esc(c.phone||'')}</small></div><button class="share" data-edit="${c.id}" title="עריכה">✏️</button><button class="del" data-del="${c.id}">🗑</button></li>`).join(''):'<li class="empty">אין אנשי קשר</li>';
}
$('#adminContacts').onclick=e=>{
  const ed=e.target.closest('[data-edit]');if(ed)return editContact(db.contacts.find(c=>c.id===ed.dataset.edit));
  const dl=e.target.closest('[data-del]');if(dl&&confirm('למחוק את איש הקשר?')){const c=db.contacts.find(c=>c.id===dl.dataset.del);c.del=1;touch(c);save();renderContacts()}};

// כל מכשיר פתוח מעורר את בדיקת התזכורות בשרת (לכל היותר פעם בדקה) – גיבוי למתזמן החיצוני
let lastCron=0;
function pingCron(){if(Date.now()-lastCron<55000)return;lastCron=Date.now();fetch('/api/cron').catch(()=>{})}

// פתיחה מהתראה: חלון נודניק (עובד גם באייפון, שאין בו כפתורי פעולה בהתראה)
async function snoozeFor(r,min){
  try{const sub=await (await navigator.serviceWorker.ready).pushManager.getSubscription();
    if(!sub){toast('המכשיר לא רשום להתראות');return}
    const x=await fetch('/api/snooze',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({endpoint:sub.endpoint,minutes:min,title:r.t,body:r.b,eid:r.e,at:r.a,req:!!r.q})});
    toast(x.ok?`נודניק – תזכורת בעוד ${min} דק׳ ⏰`:'לא הצלחתי לקבוע נודניק');
  }catch{toast('שגיאה')}$('#sheet').hidden=true}
function showRemind(r){showAlarm(r)}
if('serviceWorker' in navigator)navigator.serviceWorker.addEventListener('message',ev=>{const d=ev.data||{};if(d.type==='ring')d.r&&d.r.t?showAlarm(d.r):beep();if(d.type==='remind')showRemind(d.r)});
try{const q=new URLSearchParams(location.search).get('r');if(q){showRemind(JSON.parse(q));history.replaceState(null,'',location.pathname)}}catch{}

// בחירת שעה: שדה אחד (כמו התאריך); לחיצה פותחת חלון בחירה
let curDT={};
function openTimePicker(init,cb){
  let [h,m]=(init||'18:00').split(':').map(Number);
  const show=()=>{$('#tmDisplay').textContent=pad(h)+':'+pad(m);
    $$('#tmHours button').forEach(b=>b.classList.toggle('on',+b.dataset.v===h));
    $$('#tmMins button').forEach(b=>b.classList.toggle('on',+b.dataset.v===m))};
  $('#tmHours').innerHTML=Array.from({length:24},(_,i)=>`<button type="button" data-v="${i}">${pad(i)}</button>`).join('');
  $('#tmMins').innerHTML=Array.from({length:12},(_,i)=>`<button type="button" data-v="${i*5}">${pad(i*5)}</button>`).join('');
  $('#tmHours').onclick=e=>{const b=e.target.closest('[data-v]');if(b){h=+b.dataset.v;show()}};
  $('#tmMins').onclick=e=>{const b=e.target.closest('[data-v]');if(b){m=+b.dataset.v;show()}};
  const step=d=>{let t=h*60+m+d;t=(t%1440+1440)%1440;h=Math.floor(t/60);m=t%60;show()};
  $('#tmMinus').onclick=()=>step(-1);$('#tmPlus').onclick=()=>step(1);
  $('#tmOk').onclick=()=>{$('#timeModal').hidden=true;cb(pad(h)+':'+pad(m))};
  $('#timeModal').onclick=e=>{if(e.target.id==='timeModal')$('#timeModal').hidden=true};
  show();$('#timeModal').hidden=false;
}
function setEvTime(v){$('#eventForm [name=time]').value=v;$('#timeBtn').textContent=v;renderDow()}
$('#timeBtn').onclick=()=>openTimePicker($('#eventForm [name=time]').value,setEvTime);
const DAYN=['ראשון','שני','שלישי','רביעי','חמישי','שישי','שבת'];
function renderDow(){
  const main=$('#eventForm [name=time]').value||'18:00';
  const keep=[...$$('#dowDays input:checked')].map(i=>+i.value);
  $('#dowDays').innerHTML=DAYN.map((n,i)=>`<div class="dowRow"><label class="ck"><input type="checkbox" name="days" value="${i}" ${keep.includes(i)?'checked':''}><span>${n}</span></label><button type="button" class="dtBtn ${curDT[i]?'ov':''}" data-d="${i}">${curDT[i]||main}</button></div>`).join('');
}
$('#dowDays').onclick=e=>{const b=e.target.closest('.dtBtn');if(!b)return;const d=+b.dataset.d,main=$('#eventForm [name=time]').value;
  openTimePicker(curDT[d]||main,v=>{if(v===main)delete curDT[d];else curDT[d]=v;const cb=$('#dowDays input[value="'+d+'"]');if(cb)cb.checked=true;renderDow()})};
const repText=e=>e.rep==='dow'?'ימים: '+(e.days||[]).map(i=>REC.DOW[i]).join(' '):REC.LABEL[e.rep];
function openEventForm(ev){
  const f=$('#eventForm');editEv=ev?ev.id:'';clearImg();curImg=origImg=ev&&ev.img||'';
  f.querySelector('h3').textContent=ev?'עריכת אירוע':'אירוע חדש';$('#eventSave').textContent=ev?'שמור שינויים':'＋ הוסף ללוח';
  f.title.value=ev?ev.title:'';f.date.value=ev?ev.date:sel;setEvTime(ev?ev.time:'18:00');
  $$('#evKids input').forEach(i=>i.checked=ev?evKids(ev).includes(i.value):false);
  f.rep.value=ev?(ev.rep||''):'';$('#untilWrap').hidden=!(ev&&ev.rep);$('#dowBox').hidden=!(ev&&ev.rep==='dow');f.until.value=ev&&ev.until||'';
  curDT=ev&&ev.dtimes?{...ev.dtimes}:{};renderDow();$$('#dowDays input').forEach(i=>i.checked=!!(ev&&ev.rep==='dow'&&(ev.days||[]).includes(+i.value)));
  f.req.checked=!!(ev&&ev.req);f.remind.value=ev?String(ev.remind):'60';f.nag.value=ev?String(ev.nag||0):'2';
  if(curImg)getImg(curImg).then(d=>{if(d&&editEv===ev.id){$('#evImgThumb').src=d;$('#evImgPrev').hidden=false}});
  $('#eventModal').hidden=false;if(!ev)setTimeout(()=>f.title.focus(),50);
}
$('#addEventBtn').onclick=()=>openEventForm(null);
$('#eventCancel').onclick=()=>{$('#eventModal').hidden=true};
$('#eventModal').onclick=e=>{if(e.target.id==='eventModal')$('#eventModal').hidden=true};

// מסך התראה מלא עם צלצול מתמשך (עד "הבנתי" / נודניק, או עד 3 דקות)
let alarmT=null,alarmAuto=null,alarmR=null;
function stopRing(){clearTimeout(alarmT);clearTimeout(alarmAuto);alarmT=alarmAuto=null;if(navigator.vibrate)navigator.vibrate(0)}
function showAlarm(r){
  alarmR=r;const conf=!!r.q&&isParent();$('#alarmSnooze').hidden=false;$('#alarmStop').textContent=r.q?(conf?'✔ בוצע – אישרתי':'הבנתי'):'✔ הבנתי – הפסק';$('#alarmTitle').textContent=r.t||'תזכורת';$('#alarmBody').textContent=r.b||'';$('#alarm').hidden=false;
  stopRing();$('#alarmHint').hidden=!!(AC&&AC.state==='running');$('#alarmHint').style.visibility='visible';const go=()=>{playTone(tone);if(navigator.vibrate)navigator.vibrate([500,200,500,200,500])};
  const gap=()=>{const t=TONES[tone];return t&&t[6]&&toneBufs[t[6]]?toneBufs[t[6]].duration*1000+400:3000};
  const again=()=>{alarmT=setTimeout(()=>{go();again()},gap())};
  go();if(localStorage.getItem('bny-loop')!=='0')again();
  alarmAuto=setTimeout(stopRing,180000);
}
$('#alarmStop').onclick=()=>{stopRing();$('#alarm').hidden=true;const r=alarmR||{};if(!r.e)return;
  if(r.q){if(isParent())confirmDone(r.e,r.a)}
  else fetch('/api/snooze',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({action:'ack',eid:r.e,at:r.a})}).catch(()=>{})};
$('#alarmClose').onclick=()=>{stopRing();$('#alarm').hidden=true;const r=alarmR||{};if(r.q&&r.e)localStorage.setItem('bny-snz:'+r.e+':'+r.a,String(Date.now()+30*60000))};
$('#alarmSnooze').onclick=async()=>{stopRing();$('#alarm').hidden=true;const r=alarmR||{};if(r.q&&r.e)localStorage.setItem('bny-snz:'+r.e+':'+r.a,String(Date.now()+10*60000));await snoozeFor(r,10);if(!r.e)setTimeout(()=>showAlarm(r),10*60000)};
$('#alarm').addEventListener('pointerdown',()=>{try{ctx()}catch{};$('#alarmHint').style.visibility='hidden'},{passive:true});

// תמונה לאירוע: מכווצים בדפדפן, מעלים לשרת, ומציגים לפי מזהה
let pendingImg='',curImg='',origImg='',editEv='';const imgCache=new Map();
function compress(file,max=1280,q=.72){return new Promise((res,rej)=>{const im=new Image(),u=URL.createObjectURL(file);
  im.onload=()=>{const s=Math.min(1,max/Math.max(im.width,im.height)),w=Math.round(im.width*s),h=Math.round(im.height*s),c=document.createElement('canvas');c.width=w;c.height=h;c.getContext('2d').drawImage(im,0,0,w,h);URL.revokeObjectURL(u);res(c.toDataURL('image/jpeg',q))};
  im.onerror=()=>rej(new Error('bad image'));im.src=u})}
function clearImg(){pendingImg='';$('#evImgPrev').hidden=true;$('#evImgFile').value=''}
$('#evImgBtn').onclick=()=>$('#evImgFile').click();
$('#evImgFile').onchange=async e=>{const f=e.target.files[0];if(!f)return;
  try{pendingImg=await compress(f);$('#evImgThumb').src=pendingImg;$('#evImgPrev').hidden=false}catch{toast('לא הצלחתי לקרוא את התמונה');clearImg()}};
$('#evImgDel').onclick=()=>{clearImg();curImg=''};
async function getImg(id){if(imgCache.has(id))return imgCache.get(id);
  try{const r=await fetch('/api/image?id='+id,{headers:hdr()});if(!r.ok)return '';const d=(await r.json()).data;imgCache.set(id,d);return d}catch{return ''}}
function hydrateImgs(){$$('img[data-img]').forEach(async im=>{if(im.src)return;const d=await getImg(im.dataset.img);if(d)im.src=d;else im.style.display='none'})}
async function showImage(id){const d=await getImg(id);if(d)sheet('תמונה',`<img src="${d}" alt="" style="width:100%;border-radius:16px">`)}

// ניהול אירועים (עריכה / מחיקה)
function nextDate(e){const t=iso(new Date());if(!e.rep)return e.date;const far=iso(new Date(Date.now()+800*864e5));const ds=REC.occDates(e,far);return ds.find(d=>d>=t)||ds[ds.length-1]||e.date}
function renderAdminEvents(){
  if(!adminTok){$('#adminEvents').innerHTML='';return}
  const t=iso(new Date());
  const l=live(db.events).map(e=>({e,d:nextDate(e)})).sort((x,y)=>(x.d<t)-(y.d<t)||x.d.localeCompare(y.d)||REC.timeOn(x.e,x.d).localeCompare(REC.timeOn(y.e,y.d)));
  $('#adminEvents').innerHTML=l.length?l.map(({e,d})=>`<li class="item ${d<t?'done':''}" style="--c:${evKids(e).length?kidColor(evKids(e)[0]):'var(--b1)'}"><div class="avatar" style="background:${kidBg(evKids(e))}">${esc(REC.timeOn(e,d))}</div><div class="main"><b>${esc(e.title)}${kidTags(evKids(e))}</b><small>${e.req?'❗ דורש אישור · ':''}${fmtDate(d)}${e.rep?' · 🔁 '+repText(e):''}</small></div><button class="share" data-nt="${e.id}" title="שלח עכשיו">🔔</button><button class="share" data-ed="${e.id}" title="עריכה">✏️</button><button class="del" data-xd="${e.id}">🗑</button></li>`).join(''):'<li class="empty">אין אירועים</li>';
}
$('#adminEvents').onclick=e=>{
  const nt=e.target.closest('[data-nt]');if(nt)return sendNow(nt.dataset.nt);
  const ed=e.target.closest('[data-ed]');if(ed)return openEventForm(db.events.find(x=>x.id===ed.dataset.ed));
  const xd=e.target.closest('[data-xd]');if(!xd)return;const ev=db.events.find(x=>x.id===xd.dataset.xd);
  if(ev&&confirm(ev.rep?'למחוק את כל האירועים החוזרים?':'למחוק את האירוע?')){ev.del=1;touch(ev);if(ev.img)fetch('/api/image?id='+ev.img,{method:'DELETE',headers:hdr()}).catch(()=>{});save();renderCal()}};

$('#userList').addEventListener('change',async e=>{const c=e.target.closest('[data-uc]');if(!c)return;
  const d=await usersCall({action:'save',u:c.dataset.uc,n:c.dataset.n,p:!!c.dataset.p,c:c.value});if(d){renderUsers(d.users);setFamily(d.users);toast('הצבע נשמר')}});

// שליחת התראה עכשיו (מנהל): לאנשי האירוע ולהורים
async function sendNow(id){
  const ev=db.events.find(x=>x.id===id);if(!ev)return;
  const ks=evKids(ev);if(!confirm(`לשלוח עכשיו את ההתראה "${ev.title}" ל${ks.length?ks.join(', ')+' ולהורים':'כולם'}?`))return;
  try{const r=await fetch('/api/notify',{method:'POST',headers:hdr(),body:JSON.stringify({eid:id})});const d=await r.json().catch(()=>({}));
    toast(r.ok?`נשלחה ל־${d.sent} מכשירים${d.failed?` (נכשלו ${d.failed})`:''}`:'השליחה נכשלה: '+(d.error||r.status))}catch{toast('אין חיבור לשרת')}}

// אבחון התראות במכשיר
async function diagnose(){
  const L=[];const ok=(c,t)=>L.push((c?'✅ ':'❌ ')+t);
  ok('Notification' in window,'הדפדפן תומך בהתראות');
  const perm=('Notification' in window)?Notification.permission:'none';ok(perm==='granted','הרשאת התראות: '+({granted:'אושרה',denied:'נחסמה',default:'לא נשאלה'}[perm]||perm));
  const standalone=matchMedia('(display-mode: standalone)').matches||navigator.standalone;
  L.push((standalone?'✅ ':'ℹ️ ')+(standalone?'פתוח כאפליקציה (ממסך הבית)':'פתוח בדפדפן (לא ממסך הבית)'));
  let sub=null,reg=null;
  try{reg=await navigator.serviceWorker.ready;ok(!!reg.active,'שירות ההתראות פעיל (service worker)');sub=await reg.pushManager.getSubscription();
    ok(!!sub,'המכשיר רשום לקבלת התראות'+(sub?' ('+new URL(sub.endpoint).hostname+')':''))}catch(e){ok(false,'שירות ההתראות לא זמין: '+(e.message||e))}
  ok(!!token,'מחובר: '+(myName||'?')+(adminTok?' (מנהל)':''));
  if(sub&&token){try{const r=await fetch('/api/subscribe',{method:'POST',headers:hdr(),body:JSON.stringify(sub)});ok(r.ok,'הרישום נשמר בשרת');
      const t=await fetch('/api/subscribe',{method:'POST',headers:hdr(),body:JSON.stringify({test:true,endpoint:sub.endpoint})});const d=await t.json().catch(()=>({}));
      ok(t.ok,'השרת שלח התראת בדיקה'+(t.ok?' – אמורה להופיע עכשיו':': '+(d.error||t.status)))}catch(e){ok(false,'שגיאת רשת: '+(e.message||e))}}
  if(perm==='granted'&&reg){try{await reg.showNotification('בדיקה מקומית 🔔',{body:'אם ראית את זה – התצוגה במכשיר תקינה',icon:'icons/icon-192.png',tag:'bny-local-test'});L.push('ℹ️ נשלחה גם התראה מקומית מהמכשיר עצמו')}catch(e){ok(false,'התראה מקומית נכשלה: '+(e.message||e))}}
  sheet('🩺 בדיקת התראות',`<div style="line-height:1.9;font-size:15px;text-align:right">${L.map(esc).join('<br>')}</div><p class="mut" style="margin-top:12px;font-size:12px">אם מופיע ✅ בכל השורות אבל לא קפצה התראה – הבעיה בהגדרות הטלפון (התראות של האפליקציה/הדפדפן, חיסכון בסוללה, "נא לא להפריע").</p>`);
}

// משימות שממתינות לאישור ביצוע מגיל / אדוה (או המנהל)
async function confirmDone(eid,at){
  try{const r=await fetch('/api/pending',{method:'POST',headers:hdr(),body:JSON.stringify({eid,at})});
    toast(r.ok?'אושר ✔ – ההתראות נפסקו':'רק גיל, אדוה או המנהל יכולים לאשר');loadPending()}catch{toast('אין חיבור לשרת')}}
async function loadPending(){
  const box=$('#pendingBox');if(!token){box.hidden=true;return}
  try{const r=await fetch('/api/pending',{headers:hdr()});if(!r.ok){box.hidden=true;return}
    const d=await r.json();
    if(!d.can||!d.pending.length){box.hidden=true;return}
    $('#pendingList').innerHTML=d.pending.map(p=>`<li class="item" style="--c:${p.kids&&p.kids.length?kidColor(p.kids[0]):'var(--b1)'}"><div class="avatar" style="background:${kidBg(p.kids||[])}">${esc(p.time)}</div><div class="main"><b>${esc(p.title)}${kidTags(p.kids||[])}</b><small>${fmtDate(p.date)}</small></div><button class="btn doneBtn" data-eid="${p.eid}" data-at="${p.at}">✔ בוצע</button></li>`).join('');
    box.hidden=false;
    // parents / manager: open the full-screen alarm (with the snooze button) for the first unconfirmed task
    if(document.visibilityState==='visible'&&$('#alarm').hidden&&$('#sheet').hidden){
      const p=d.pending.find(x=>(+localStorage.getItem('bny-snz:'+x.eid+':'+x.at)||0)<=Date.now());
      if(p)showAlarm({t:'❗ '+p.title+(p.kids&&p.kids.length?' ('+p.kids.join(', ')+')':''),b:fmtDate(p.date)+' בשעה '+p.time,e:p.eid,a:p.at,q:true})}
  }catch{}}
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')loadPending()});
$('#pendingList').onclick=e=>{const b=e.target.closest('.doneBtn');if(b)confirmDone(b.dataset.eid,+b.dataset.at)};

// ntfy: אפליקציית התראות דחופות (קופצת על המסך, גם נעול). כל אחד נרשם לערוץ הסודי שלו.
async function ntfySetup(){
  let topic='';
  try{const r=await fetch('/api/subscribe?ntfy=1',{headers:hdr()});if(!r.ok)throw 0;topic=(await r.json()).topic}catch{return toast('לא הצלחתי לקבל ערוץ – נסה שוב')}
  sheet('📲 התראות דחופות (ntfy)',`
    <ol class="steps">
      <li>התקן את האפליקציה החינמית <b>ntfy</b>:<br><a class="miniWa" style="background:#3b82c4" href="https://play.google.com/store/apps/details?id=io.heckel.ntfy" target="_blank" rel="noopener">אנדרואיד</a> <a class="miniWa" style="background:#555" href="https://apps.apple.com/app/ntfy/id1625396347" target="_blank" rel="noopener">אייפון</a></li>
      <li>באפליקציה לחץ <b>＋</b> והזן את שם הערוץ שלך (אל תשתף אותו):<div class="topicBox" dir="ltr">${esc(topic)}</div>
        <button class="btn ghost" id="ntfyCopy" type="button" style="margin:6px 0">📋 העתק שם ערוץ</button>
        <a class="miniWa" href="ntfy://ntfy.sh/${esc(topic)}">פתח ישר ב־ntfy</a></li>
      <li>לחץ <b>"שלח בדיקה"</b> – ההתראה אמורה לקפוץ על המסך:<br><button class="btn" id="ntfyTest" type="button" style="margin-top:6px">🔔 שלח בדיקה</button></li>
      <li>באנדרואיד: בהגדרות ntfy ← <b>"Override Do Not Disturb"</b> לעדיפות מקסימלית, ו־"סוללה ← ללא הגבלה".</li>
    </ol>
    <p class="mut" style="font-size:12px">מעכשיו כל תזכורת נשלחת גם ל־ntfy בעדיפות הגבוהה ביותר, עם כפתורים "בוצע" / "נודניק" על ההתראה עצמה.</p>`);
  $('#ntfyCopy').onclick=async()=>{try{await navigator.clipboard.writeText(topic);toast('הועתק ✔')}catch{toast('העתק ידנית')}};
  $('#ntfyTest').onclick=async()=>{try{const r=await fetch('/api/subscribe',{method:'POST',headers:hdr(),body:JSON.stringify({ntfyTest:true})});toast(r.ok?'נשלחה בדיקה – בדוק את ntfy':'השליחה נכשלה')}catch{toast('אין חיבור לשרת')}};
}

// הדרכה: איך לגרום להתראה לקפוץ (Heads-up) על המסך, כולל סמסונג
function popHelp(){
  sheet('📱 התראה שקופצת על המסך',`
    <p class="mut" style="margin-bottom:10px">כשההתראה מופיעה רק כסמל קטן למעלה, הטלפון מגדיר אותה כ"שקטה". אפשר לשנות את זה בהגדרות הטלפון (שמות התפריטים עשויים להיות מעט שונים בכל דגם):</p>
    <ol class="steps">
      <li><b>סמסונג:</b> הגדרות ← התראות ← <b>התראות של אפליקציות</b> ← <b>בן יהודה</b> (או Chrome) ← בקטגוריה בחר <b>"התראה" / Alert</b> והפעל <b>"חלון קופץ"</b> (Pop-up).</li>
      <li>הגדרות ← התראות ← הגדרות מתקדמות ← <b>סגנון חלון קופץ: מפורט</b>.</li>
      <li><b>מסך נעילה:</b> הגדרות ← מסך נעילה ← התראות ← הצג תוכן.</li>
      <li><b>סוללה:</b> הגדרות ← סוללה ← מגבלות שימוש ברקע ← <b>אפליקציות שלעולם לא נרדמות</b> ← הוסף את בן יהודה.</li>
      <li><b>נא לא להפריע:</b> הוסף את האפליקציה כחריג.</li>
    </ol>
    <p class="mut" style="font-size:12px;margin:8px 0">הדרך האמינה ביותר: אפליקציית <b>ntfy</b>. התראות בעדיפות מקסימלית שלה קופצות על המסך כברירת מחדל, ויש עליהן כפתורי בוצע / נודניק.</p>
    <button class="btn" id="popNtfy" type="button">📲 הגדר ntfy</button>`);
  $('#popNtfy').onclick=ntfySetup;
}

// טלגרם: התראה כהודעה רגילה (קופצת על המסך), עם כפתורי בוצע / נודניק
async function tgSetup(){
  let d;try{const r=await fetch('/api/subscribe?tg=1',{headers:hdr()});d=await r.json();if(!r.ok)throw 0}catch{return toast('שגיאה בחיבור לשרת')}
  if(!d.configured){
    return sheet('✈️ התראות בטלגרם – הגדרה חד־פעמית (מנהל)',`
      <ol class="steps">
        <li>בטלגרם חפש את <b>@BotFather</b> ושלח לו <b>/newbot</b>. בחר שם ושם משתמש לבוט (למשל <b>BenYehudaFamilyBot</b>).</li>
        <li>הוא ישלח לך <b>טוקן</b> (מחרוזת ארוכה). העתק אותו.</li>
        <li>ב־Vercel: Settings ← Environment Variables ← הוסף <b dir="ltr">TELEGRAM_BOT_TOKEN</b> עם הטוקן ← <b>Redeploy</b>.</li>
        <li>חזור לכאן ולחץ שוב על "התראות בטלגרם".</li>
      </ol>`);
  }
  if(d.linked){
    sheet('✈️ טלגרם מחובר ✅',`<p class="mut" style="margin-bottom:10px">התזכורות שלך מגיעות גם לטלגרם, עם כפתורי "בוצע" / "נודניק".</p>
      <button class="btn" id="tgTest" type="button">🔔 שלח הודעת בדיקה</button>
      <p class="mut" style="font-size:12px;margin-top:10px">כדי שהיא תקפוץ על המסך: בטלגרם ← הגדרות ← התראות וצלילים ← הפעל "התראות" ו"תצוגה מקדימה", ובהגדרות הטלפון ← אפליקציות ← Telegram ← התראות ← "התראה" + חלון קופץ.</p>`);
    $('#tgTest').onclick=async()=>{try{const r=await fetch('/api/subscribe',{method:'POST',headers:hdr(),body:JSON.stringify({tgTest:true})});toast(r.ok?'נשלחה בדיקה – בדוק בטלגרם':'השליחה נכשלה')}catch{toast('אין חיבור לשרת')}};
  }else{
    sheet('✈️ התראות בטלגרם',`<ol class="steps">
        <li>לחץ על הכפתור כדי לפתוח את הבוט בטלגרם:<br><a class="miniWa" style="background:#2aabee" href="${esc(d.link)}" target="_blank" rel="noopener">✈️ פתח בטלגרם</a></li>
        <li>בטלגרם לחץ <b>Start</b> (התחל).</li>
        <li>חזור לכאן ולחץ:<br><button class="btn" id="tgCheck" type="button" style="margin-top:6px">בדקתי – בדוק חיבור</button></li>
      </ol>`);
    $('#tgCheck').onclick=tgSetup;
  }
}

// ---- אפליקציית אנדרואיד (APK): התראה במסך מלא גם כשהאפליקציה סגורה ----
function inApp(){return !!window.AndroidBridge}
function syncNativeSound(){try{if(window.AndroidBridge&&AndroidBridge.setSound)AndroidBridge.setSound(tone)}catch{}}
async function linkNative(){
  syncNativeSound();
  if(!inApp()||!token)return;
  try{const r=await fetch('/api/subscribe?ntfy=1',{headers:hdr()});if(r.ok){const {topic}=await r.json();if(topic)AndroidBridge.setTopic(topic)}}catch{}
}
function appSetup(){
  if(inApp()){
    let s={};try{s=JSON.parse(AndroidBridge.status())}catch{}
    const row=(ok,t,fix)=>`<div style="display:flex;align-items:center;gap:8px;justify-content:space-between;padding:4px 0"><span>${ok?'✅':'❌'} ${t}</span>${ok||!fix?'':`<button class="miniWa" data-fix="${fix}" style="border:0;cursor:pointer">תקן</button>`}</div>`;
    sheet('📲 אפליקציית אנדרואיד',`<div style="text-align:right;margin-bottom:12px">
        ${row(s.topic,'מחובר לחשבון (ערוץ התראות)')}${row(s.listening,'מאזין לשרת ההתראות עכשיו')}${row(s.notif,'הרשאת התראות','notif')}${row(s.overlay,'הצגה מעל אפליקציות אחרות','overlay')}${row(s.fsi,'הודעות במסך מלא','fsi')}${row(s.battery,'סוללה: ללא הגבלה','battery')}</div>
      <button class="btn" id="appTest" type="button">🔔 בדיקת מסך מלא</button>
      <p class="mut" style="font-size:12px;margin-top:10px">כל שורה עם ❌ – לחץ "תקן", אשר בהגדרות, וחזור לכאן. לבדיקת מסך נעול: לחץ "בדיקה" וכבה את המסך תוך 5 שניות.</p>`);
    $$('#sheetBody [data-fix]').forEach(b=>b.onclick=()=>{try{AndroidBridge.openSetting(b.dataset.fix)}catch{}});
    $('#appTest').onclick=()=>{linkNative();setTimeout(()=>AndroidBridge.testAlarm(),400)};
    linkNative();
  }else{
    sheet('📲 אפליקציית אנדרואיד',`<p style="margin-bottom:10px">האפליקציה פותחת <b>מסך מלא עם צליל</b> על התראה, גם כשהטלפון נעול או כשאתה באפליקציה אחרת, ובו כפתורי "בוצע" / "נודניק".</p>
      <ol class="steps">
        <li>הורד והתקן:<br><a class="miniWa" style="background:#18b37e" href="/downloads/benyehuda.apk">⬇️ הורד את האפליקציה (APK)</a></li>
        <li>אשר "התקנה ממקור לא מוכר" כשהטלפון שואל. אם יש אזהרת Play Protect – "התקן בכל זאת".</li>
        <li>פתח את האפליקציה, היכנס בשם המשתמש והסיסמה, ואשר את ההרשאות שהיא מבקשת.</li>
      </ol><p class="mut" style="font-size:12px">אנדרואיד בלבד. באייפון אין דרך לעשות את זה.</p>`);
  }
}

// בתוך אפליקציית האנדרואיד: מצב חשוך לפי הטלפון (ה-WebView לא תמיד מדווח עליו לדף)
function applyNativeTheme(){try{if(window.AndroidBridge&&AndroidBridge.isDark)document.documentElement.dataset.theme=AndroidBridge.isDark()?'dark':'light'}catch{}}
applyNativeTheme();addEventListener('focus',applyNativeTheme);document.addEventListener('visibilitychange',applyNativeTheme);
