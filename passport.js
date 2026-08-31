(function(){
var DESTS=[
{id:'bahamas',name:'Bahamas Beachfront',emoji:'\uD83C\uDFD6\uFE0F',route:'/experience/bahamas-beachfront',color:'#0077b6'},
{id:'santino',name:'Santino Cult',emoji:'\uD83C\uDFDB\uFE0F',route:'/experience/santino-cult',color:'#c62368'},
{id:'stcroix',name:'St. Croix Walk',emoji:'\uD83C\uDF34',route:'/experience/stcroix-beachwalk',color:'#006994'},
{id:'dubai',name:'Dubai Skyline',emoji:'\uD83C\uDFD9\uFE0F',route:'/experience/dubai-skyline',color:'#e94560'},
{id:'cancun',name:'Cancun Paradise',emoji:'\uD83C\uDFDD\uFE0F',route:'/experience/cancun-paradise',color:'#00b4d8'}
];
var KEY='jj_passport_stamps';
var SITE='https://joeljourneys.com';

function getStamps(){try{return JSON.parse(localStorage.getItem(KEY))||{}}catch(e){return{}}}
function setStamps(s){localStorage.setItem(KEY,JSON.stringify(s))}
function currentId(){var p=location.pathname;for(var i=0;i<DESTS.length;i++){if(p.indexOf(DESTS[i].route)>-1)return DESTS[i].id}return null}
function progress(){var s=getStamps(),c=0;DESTS.forEach(function(d){if(s[d.id])c++});return c}

function stamp(id){
var s=getStamps();
if(s[id])return false;
s[id]={t:new Date().toISOString()};
setStamps(s);
return true;
}

function toast(msg){
var el=document.createElement('div');
el.textContent=msg;
el.style.cssText='position:fixed;bottom:90px;left:50%;transform:translateX(-50%);background:linear-gradient(135deg,#FFD700,#ff8c00);color:#000;padding:12px 28px;border-radius:100px;font-size:14px;font-weight:700;font-family:Inter,sans-serif;z-index:999;box-shadow:0 8px 30px rgba(255,215,0,0.4);transition:opacity .6s;pointer-events:none;';
document.body.appendChild(el);
setTimeout(function(){el.style.opacity='0'},2200);
setTimeout(function(){el.parentNode.removeChild(el)},2800);
}

function share(platform){
var p=progress();
var msg='I\'ve explored '+p+' of 5 luxury VR destinations on Joel Journeys! ';
if(p===5)msg+='All stamps collected! ';
msg+=SITE+'/quiz.html';
var url;
if(platform==='telegram'){
url='https://t.me/share/url?url='+encodeURIComponent(SITE)+'&text='+encodeURIComponent(msg);
}else{
url='https://wa.me/?text='+encodeURIComponent(msg);
}
window.open(url,'_blank');
}

function buildBadge(){
var badge=document.createElement('div');
badge.id='jj-passport-badge';
badge.innerHTML='<div id="jj-passport-count">'+progress()+'/5</div><div style="font-size:9px;letter-spacing:1px;text-transform:uppercase;opacity:0.7;margin-top:2px;">Passport</div>';
badge.style.cssText='position:fixed;bottom:20px;right:20px;z-index:150;background:rgba(10,10,20,0.92);backdrop-filter:blur(20px);border:1px solid rgba(255,215,0,0.3);border-radius:16px;padding:14px 18px;cursor:pointer;text-align:center;color:#FFD700;font-family:Inter,sans-serif;font-weight:700;font-size:18px;box-shadow:0 8px 30px rgba(0,0,0,0.5);transition:all .3s;pointer-events:auto;';
badge.addEventListener('mouseenter',function(){this.style.transform='scale(1.08)';this.style.borderColor='#FFD700'});
badge.addEventListener('mouseleave',function(){this.style.transform='scale(1)';this.style.borderColor='rgba(255,215,0,0.3)'});
badge.addEventListener('click',openModal);
document.body.appendChild(badge);
}

function updateBadge(){
var el=document.getElementById('jj-passport-count');
if(el)el.textContent=progress()+'/5';
}

function openModal(){
var overlay=document.createElement('div');
overlay.id='jj-passport-overlay';
overlay.style.cssText='position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.85);backdrop-filter:blur(10px);z-index:800;display:flex;align-items:center;justify-content:center;padding:20px;';
overlay.addEventListener('click',function(e){if(e.target===overlay)closeModal()});

var box=document.createElement('div');
box.style.cssText='background:rgba(12,12,18,0.97);border:1px solid rgba(255,215,0,0.2);border-radius:28px;padding:40px;max-width:560px;width:100%;max-height:85vh;overflow-y:auto;position:relative;';

var closeBtn=document.createElement('div');
closeBtn.innerHTML='&times;';
closeBtn.style.cssText='position:absolute;top:16px;right:20px;font-size:28px;color:rgba(255,255,255,0.4);cursor:pointer;line-height:1;';
closeBtn.addEventListener('click',closeModal);
box.appendChild(closeBtn);

var title=document.createElement('div');
title.style.cssText='text-align:center;margin-bottom:8px;';
title.innerHTML='<div style="font-size:36px;margin-bottom:8px;">\uD83C\uDF0F</div><div style="font-family:Playfair Display,serif;font-size:2rem;color:#FFD700;font-weight:700;">Destination Passport</div>';
box.appendChild(title);

var p=progress();
var sub=document.createElement('div');
sub.style.cssText='text-align:center;color:rgba(255,255,255,0.5);font-size:14px;margin-bottom:28px;';
sub.textContent=p+' of 5 destinations explored';
box.appendChild(sub);

var barOuter=document.createElement('div');
barOuter.style.cssText='width:100%;height:8px;background:rgba(255,255,255,0.08);border-radius:100px;margin-bottom:30px;overflow:hidden;';
var barInner=document.createElement('div');
barInner.style.cssText='height:100%;background:linear-gradient(90deg,#FFD700,#ff8c00);border-radius:100px;transition:width .8s ease;width:'+(p/5*100)+'%;';
barOuter.appendChild(barInner);
box.appendChild(barOuter);

var stamps=getStamps();
DESTS.forEach(function(d){
var row=document.createElement('div');
var visited=!!stamps[d.id];
row.style.cssText='display:flex;align-items:center;gap:16px;padding:14px 16px;border-radius:14px;margin-bottom:10px;background:'+(visited?'rgba(255,215,0,0.08)':'rgba(255,255,255,0.03)')+';border:1px solid '+(visited?'rgba(255,215,0,0.2)':'rgba(255,255,255,0.05)')+';';

var emoji=document.createElement('div');
emoji.style.cssText='font-size:28px;width:44px;height:44px;display:flex;align-items:center;justify-content:center;border-radius:12px;background:'+(visited?'rgba(255,215,0,0.1)':'rgba(255,255,255,0.05)')+';flex-shrink:0;';
emoji.textContent=d.emoji;
row.appendChild(emoji);

var info=document.createElement('div');
info.style.cssText='flex:1;min-width:0;';
info.innerHTML='<div style="font-weight:600;color:'+(visited?'#FFD700':'rgba(255,255,255,0.6)')+';font-size:14px;">'+d.name+'</div><div style="font-size:11px;color:rgba(255,255,255,0.3);margin-top:2px;">'+(visited?'Stamp collected':'Not yet visited')+'</div>';
row.appendChild(info);

var icon=document.createElement('div');
icon.style.cssText='font-size:18px;color:'+(visited?'#FFD700':'rgba(255,255,255,0.15)')+';';
icon.textContent=visited?'\u2713':'\u25CB';
row.appendChild(icon);

box.appendChild(row);
});

var shareRow=document.createElement('div');
shareRow.style.cssText='display:flex;gap:10px;margin-top:24px;';

var tgBtn=document.createElement('button');
tgBtn.textContent='Share on Telegram';
tgBtn.style.cssText='flex:1;padding:14px 0;background:linear-gradient(135deg,#2AABEE,#229ED9);color:#fff;border:none;border-radius:12px;font-size:13px;font-weight:700;cursor:pointer;font-family:Inter,sans-serif;transition:all .3s;';
tgBtn.addEventListener('click',function(){share('telegram')});
tgBtn.addEventListener('mouseenter',function(){this.style.transform='translateY(-2px)'});
tgBtn.addEventListener('mouseleave',function(){this.style.transform='none'});
shareRow.appendChild(tgBtn);

var waBtn=document.createElement('button');
waBtn.textContent='Share on WhatsApp';
waBtn.style.cssText='flex:1;padding:14px 0;background:linear-gradient(135deg,#25D366,#128C7E);color:#fff;border:none;border-radius:12px;font-size:13px;font-weight:700;cursor:pointer;font-family:Inter,sans-serif;transition:all .3s;';
waBtn.addEventListener('click',function(){share('whatsapp')});
waBtn.addEventListener('mouseenter',function(){this.style.transform='translateY(-2px)'});
waBtn.addEventListener('mouseleave',function(){this.style.transform='none'});
shareRow.appendChild(waBtn);
box.appendChild(shareRow);

if(p===5){
var done=document.createElement('div');
done.style.cssText='text-align:center;margin-top:20px;padding:16px;background:rgba(255,215,0,0.08);border:1px solid rgba(255,215,0,0.2);border-radius:12px;color:#FFD700;font-size:14px;font-weight:600;';
done.textContent='All stamps collected! You\'re a true luxury explorer.';
box.appendChild(done);
}

overlay.appendChild(box);
document.body.appendChild(overlay);
}

function closeModal(){
var el=document.getElementById('jj-passport-overlay');
if(el)el.parentNode.removeChild(el);
}

function init(){
var id=currentId();
if(!id)return;
buildBadge();

var vid=document.getElementById('vid360');
if(!vid)return;

function onPlay(){
var isNew=stamp(id);
updateBadge();
if(isNew)toast('Passport stamped: '+id+'!');
}

vid.addEventListener('playing',onPlay,{once:true});

// Also listen on playov click as backup
var playov=document.getElementById('playov');
if(playov){
var origClick=playov.onclick;
playov.addEventListener('click',function(){
setTimeout(function(){if(!vid.paused)onPlay()},1500);
},{once:true});
}
}

init();
})();
