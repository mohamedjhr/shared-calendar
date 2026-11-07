(() => {
  'use strict';
  const cfg = window.CALENDAR_CONFIG || {};
  const configured = cfg.supabaseUrl?.startsWith('https://') && cfg.supabaseKey && !cfg.supabaseKey.startsWith('PASTE_');
  const db = configured && window.supabase ? window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseKey) : null;
  const $ = id => document.getElementById(id);
  const calendar = $('calendar');
  const dialog = $('bookingDialog');
  const times = (from, to) => Array.from({length: (to - from) * 2}, (_, i) => from * 60 + 30 * i);
  const ordinary = [...times(8, 14), ...times(14, 16), ...times(16, 22)];
  const LATE = 1320;
  const ZONE = 'Europe/Brussels';
  let week = 0, afternoonOpen = false, bookings = new Map(), activeSlot = null, pending = false;
  let channel = null;
  const dateParts = new Intl.DateTimeFormat('fr-BE', {timeZone: ZONE, year: 'numeric', month: '2-digit', day: '2-digit', hour:'2-digit', minute:'2-digit', hourCycle:'h23'});
  function nowParts() {
    const p = Object.fromEntries(dateParts.formatToParts(new Date()).filter(x=>x.type!=='literal').map(x=>[x.type,Number(x.value)]));
    return {date:`${p.year}-${String(p.month).padStart(2,'0')}-${String(p.day).padStart(2,'0')}`, minutes:p.hour*60+p.minute};
  }
  function startOfWeek(date) {const d=new Date(`${date}T12:00:00Z`);const day=d.getUTCDay();d.setUTCDate(d.getUTCDate()-((day+6)%7));return d;}
  function iso(d){return d.toISOString().slice(0,10)}
  function addDays(d,n){const copy=new Date(d);copy.setUTCDate(copy.getUTCDate()+n);return copy}
  function fmt(d, opts){return new Intl.DateTimeFormat('fr-BE',{timeZone:'UTC',...opts}).format(d)}
  function timeLabel(n){return n===LATE?'Après 22 h':`${String(Math.floor(n/60)).padStart(2,'0')}:${String(n%60).padStart(2,'0')}`}
  function key(date,minutes){return `${date}|${minutes}`}
  function setStatus(message, state){$('statusText').textContent=message;$('status').className=`status ${state||''}`}
  function showError(message){$('setupNotice').textContent=message;$('setupNotice').classList.remove('hidden')}
  function currentMonday(){return startOfWeek(nowParts().date)}
  function makeSlot(date,minute){
    const info=bookings.get(key(date,minute));const now=nowParts();
    const past=date<now.date || (date===now.date && minute!==LATE && minute<=now.minutes);
    const button=document.createElement('button');button.type='button';button.className='slot'+(info?' booked':'')+(past?' elapsed':'');button.disabled=past||!db;
    button.title=info?`Réservé par ${info.person_name}`:past?'Créneau passé':`Réserver ${timeLabel(minute)}`;
    const name=document.createElement('span');name.textContent=info?info.person_name:'';button.append(name);
    button.addEventListener('click',()=>openDialog(date,minute,info));return button;
  }
  function makeRow(dates, minute, late=false){
    const row=document.createElement('div');row.className='time-row'+(late?' late':'');
    const label=document.createElement('div');label.className='time-label';label.textContent=late?'22 h +':timeLabel(minute);row.append(label);
    dates.forEach(date=>row.append(makeSlot(date,minute)));calendar.append(row);
  }
  function render(){
    const monday=addDays(currentMonday(),week*7);const dates=Array.from({length:7},(_,i)=>iso(addDays(monday,i)));
    $('prevWeek').disabled=week===0;$('nextWeek').disabled=week===1;
    const last=addDays(monday,6);$('rangeLabel').textContent=`${fmt(monday,{month:'short',day:'numeric'})} – ${fmt(last,{month:'short',day:'numeric',year:'numeric'})}`;
    calendar.replaceChildren();
    const header=document.createElement('div');header.className='calendar-head';
    const corner=document.createElement('div');corner.className='headcell';header.append(corner);
    dates.forEach(date=>{const dt=new Date(`${date}T12:00:00Z`);const cell=document.createElement('div');cell.className='headcell'+(date===nowParts().date?' is-today':'');const day=document.createElement('div');day.className='head-day';day.textContent=fmt(dt,{weekday:'short'});const num=document.createElement('div');num.className='head-date';num.textContent=fmt(dt,{day:'numeric'});cell.append(day,num);header.append(cell)});calendar.append(header);
    times(8,14).forEach(t=>makeRow(dates,t));
    const separator=document.createElement('button');separator.type='button';separator.className='separator';separator.setAttribute('aria-expanded',String(afternoonOpen));
    const title=document.createElement('span');title.textContent='14:00 – 16:00';const hint=document.createElement('small');hint.textContent=afternoonOpen?'▴ Masquer les créneaux':'▾ Afficher les créneaux';separator.append(title,hint);separator.addEventListener('click',()=>{afternoonOpen=!afternoonOpen;render()});calendar.append(separator);
    if(afternoonOpen)times(14,16).forEach(t=>makeRow(dates,t));
    times(16,22).forEach(t=>makeRow(dates,t));makeRow(dates,LATE,true);
  }
  async function load(){
    if(!db)return;
    const monday=currentMonday(),end=iso(addDays(monday,14));
    const {data,error}=await db.from('bookings').select('booking_date,slot_minutes,person_name').gte('booking_date',iso(monday)).lt('booking_date',end);
    if(error){setStatus('Erreur de connexion','offline');showError(`Impossible de charger les réservations : ${error.message}`);return}
    bookings=new Map(data.map(x=>[key(x.booking_date,x.slot_minutes),x]));setStatus('Synchronisation active','online');$('setupNotice').classList.add('hidden');render();
  }
  function openDialog(date,minutes,info){activeSlot={date,minutes,info};$('dialogError').textContent='';$('dialogTitle').textContent=info?'Modifier la réservation':'Réserver un créneau';
    const dt=new Date(`${date}T12:00:00Z`);$('dialogTime').textContent=`${fmt(dt,{weekday:'long',day:'numeric',month:'long'})} · ${timeLabel(minutes)}`;
    $('personName').value=info?.person_name||'';$('saveBooking').textContent=info?'Enregistrer':'Réserver';$('deleteBooking').classList.toggle('hidden',!info);dialog.showModal();$('personName').focus();
  }
  function working(on){pending=on;$('saveBooking').disabled=on;$('deleteBooking').disabled=on;$('cancelDialog').disabled=on}
  async function save(ev){ev.preventDefault();if(pending||!activeSlot||!db)return;const person=$('personName').value.trim();if(!person)return;
    working(true);$('dialogError').textContent='';const {date,minutes,info}=activeSlot;
    try{
      const result=info?await db.from('bookings').update({person_name:person}).eq('booking_date',date).eq('slot_minutes',minutes).select('booking_date')
       :await db.from('bookings').insert({booking_date:date,slot_minutes:minutes,person_name:person});
      if(result.error)throw result.error;
      if(info && (!result.data||result.data.length===0))throw new Error('La réservation a été modifiée. Veuillez actualiser la page.');
      dialog.close();activeSlot=null;await load();
    }catch(e){$('dialogError').textContent=e.code==='23505'?'Ce créneau vient d’être réservé. Choisissez-en un autre.':e.message;await load();}
    finally{working(false)}
  }
  async function removeBooking(){if(pending||!activeSlot?.info||!db)return;working(true);$('dialogError').textContent='';const {date,minutes}=activeSlot;
    try{const {error}=await db.from('bookings').delete().eq('booking_date',date).eq('slot_minutes',minutes);if(error)throw error;dialog.close();activeSlot=null;await load()}catch(e){$('dialogError').textContent=e.message}finally{working(false)}
  }
  $('bookingForm').addEventListener('submit',save);$('cancelDialog').addEventListener('click',()=>dialog.close());$('deleteBooking').addEventListener('click',removeBooking);
  $('prevWeek').addEventListener('click',()=>{week=0;render()});$('nextWeek').addEventListener('click',()=>{week=1;render()});$('currentWeek').addEventListener('click',()=>{week=0;render()});
  render();
  if(!db){setStatus('Configuration nécessaire','offline');showError('Ajoutez l’URL de votre projet Supabase et sa clé publique dans config.js, puis actualisez la page.');return}
  load();
  channel=db.channel('shared-bookings').on('postgres_changes',{event:'*',schema:'public',table:'bookings'},()=>load()).subscribe(status=>{if(status==='CHANNEL_ERROR'||status==='TIMED_OUT')setStatus('Actualisation périodique','offline')});
  // Fallback sync and new-week rollover, including when the tab was sleeping.
  setInterval(()=>{load()},20000);
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)load()});
})();
