import { useState, useEffect, useRef } from "react";

const FB_BASE = "https://studytoon-dad1f-default-rtdb.firebaseio.com";
const MW = 180, MH = 90, CELL = 7;
const FUND_PER_MIN = 1000 / 60;
const MINS_PER_CELL = 60;
const ATTACK_RESOLVE_MS = 24 * 60 * 60 * 1000;
const INCOME_PER_100TILES_PER_HOUR = 100; // 100マスで100💰/時間
const SYNC_INTERVAL = 5000; // 5秒ごとにsync

function roomPath(roomCode, sub) {
  return `rooms/${roomCode}${sub ? "/" + sub : ""}`;
}
async function fbGet(roomCode, sub) {
  try { const r = await fetch(`${FB_BASE}/${roomPath(roomCode, sub)}.json`); return await r.json(); } catch { return null; }
}
async function fbSet(roomCode, sub, data) {
  try { await fetch(`${FB_BASE}/${roomPath(roomCode, sub)}.json`, { method:"PUT", headers:{"Content-Type":"application/json"}, body:JSON.stringify(data) }); return true; } catch { return false; }
}

const RAW_MAP = (() => {
  const land = new Uint8Array(MW * MH);
  const rects = [
    [10,8,42,28],[8,28,25,20],[12,20,30,12],[22,36,12,8],
    [20,42,30,18],[18,58,24,22],[22,76,16,10],
    [72,10,16,18],[70,18,20,12],[68,24,14,8],
    [82,4,88,22],[80,22,50,14],[88,30,20,14],[96,36,16,12],
    [72,26,24,8],[70,30,28,42],[74,68,20,14],
    [102,30,18,22],[108,48,12,8],
    [118,10,30,28],[116,28,22,14],
    [124,40,16,14],[130,48,14,10],
    [140,18,6,18],[144,14,4,8],
    [130,58,26,18],[128,72,10,10],[148,60,8,8],
    [0,82,MW,8],
  ];
  const fill=(x0,y0,w,h)=>{
    for(let y=y0;y<y0+h;y++) for(let x=x0;x<x0+w;x++){
      if(x<0||x>=MW||y<0||y>=MH)continue;
      if(Math.min(x-x0,x0+w-1-x)+Math.min(y-y0,y0+h-1-y)>=3)land[y*MW+x]=1;
    }
  };
  rects.forEach(r=>fill(...r));
  return land;
})();
const LAND_IDX=[]; for(let i=0;i<MW*MH;i++) if(RAW_MAP[i]) LAND_IDX.push(i);

const REGION_LABELS=[
  {name:"北米",x:22,y:18},{name:"南米",x:24,y:58},{name:"西欧",x:72,y:16},
  {name:"東欧",x:90,y:16},{name:"ロシア",x:115,y:8},{name:"中東",x:94,y:32},
  {name:"アフリカ",x:76,y:46},{name:"南アジア",x:108,y:36},{name:"東アジア",x:126,y:18},
  {name:"東南アジア",x:128,y:44},{name:"オセアニア",x:136,y:64},
];

const POI=[
  {id:"tokyo",   name:"東京",        x:144,y:22,icon:"🏙",income:2000},
  {id:"ny",      name:"NY",          x:28, y:22,icon:"🏙",income:2000},
  {id:"london",  name:"ロンドン",    x:76, y:15,icon:"🏙",income:2000},
  {id:"beijing", name:"北京",        x:132,y:20,icon:"🏙",income:2000},
  {id:"moscow",  name:"モスクワ",    x:98, y:13,icon:"🏙",income:2000},
  {id:"delhi",   name:"デリー",      x:110,y:34,icon:"🏙",income:1800},
  {id:"paris",   name:"パリ",        x:77, y:20,icon:"🏙",income:1800},
  {id:"la",      name:"LA",          x:14, y:26,icon:"🏙",income:1800},
  {id:"sydney",  name:"シドニー",    x:144,y:68,icon:"🏙",income:1500},
  {id:"berlin",  name:"ベルリン",    x:84, y:14,icon:"🏙",income:1500},
  {id:"rome",    name:"ローマ",      x:82, y:22,icon:"🏙",income:1500},
  {id:"madrid",  name:"マドリード",  x:72, y:22,icon:"🏙",income:1500},
  {id:"toronto", name:"トロント",    x:30, y:18,icon:"🏙",income:1500},
  {id:"chicago", name:"シカゴ",      x:26, y:20,icon:"🏙",income:1500},
  {id:"seoul",   name:"ソウル",      x:138,y:20,icon:"🏙",income:1500},
  {id:"shanghai",name:"上海",        x:136,y:24,icon:"🏙",income:1800},
  {id:"osaka",   name:"大阪",        x:142,y:24,icon:"🏙",income:1500},
  {id:"mumbai",  name:"ムンバイ",    x:106,y:38,icon:"🏙",income:1500},
  {id:"istanbul",name:"イスタンブール",x:88,y:24,icon:"🏙",income:1500},
  {id:"lagos",   name:"ラゴス",      x:76, y:50,icon:"🏙",income:1200},
  {id:"cairo2",  name:"カイロ",      x:88, y:30,icon:"🏙",income:1500},
  {id:"nairobi", name:"ナイロビ",    x:90, y:56,icon:"🏙",income:1000},
  {id:"jakarta", name:"ジャカルタ",  x:132,y:52,icon:"🏙",income:1200},
  {id:"bangkok", name:"バンコク",    x:128,y:44,icon:"🏙",income:1200},
  {id:"mexico",  name:"メキシコC",   x:20, y:36,icon:"🏙",income:1200},
  {id:"bogota",  name:"ボゴタ",      x:22, y:46,icon:"🏙",income:1000},
  {id:"buenos",  name:"ブエノス",    x:24, y:72,icon:"🏙",income:1000},
  {id:"warsaw",  name:"ワルシャワ",  x:86, y:14,icon:"🏙",income:1200},
  {id:"vienna",  name:"ウィーン",    x:84, y:18,icon:"🏙",income:1200},
  {id:"stockholm",name:"ストックホルム",x:84,y:8,icon:"🏙",income:1200},
  {id:"sing",    name:"シンガポール",x:130,y:48,icon:"⚓",income:1800},
  {id:"cairo",   name:"スエズ",      x:90, y:32,icon:"⚓",income:1800},
  {id:"hormuz",  name:"ホルムズ",    x:102,y:34,icon:"⚓",income:1600},
  {id:"panama",  name:"パナマ",      x:22, y:40,icon:"⚓",income:1600},
  {id:"malacca", name:"マラッカ",    x:128,y:50,icon:"⚓",income:1600},
  {id:"gibraltar",name:"ジブラルタル",x:70,y:24,icon:"⚓",income:1400},
  {id:"bosporus",name:"ボスポラス",  x:88, y:22,icon:"⚓",income:1400},
  {id:"dover",   name:"ドーバー",    x:76, y:14,icon:"⚓",income:1200},
  {id:"taiwan",  name:"台湾海峡",    x:138,y:26,icon:"⚓",income:1400},
  {id:"capetown",name:"喜望峰",      x:80, y:72,icon:"⚓",income:1200},
  {id:"dubai",   name:"ペルシャ湾",  x:100,y:36,icon:"⛏",income:1500},
  {id:"amazon",  name:"アマゾン",    x:26, y:52,icon:"⛏",income:1200},
  {id:"congo",   name:"コンゴ資源",  x:82, y:56,icon:"⛏",income:1000},
  {id:"siberia", name:"シベリア",    x:120,y:10,icon:"⛏",income:1200},
  {id:"alaska",  name:"アラスカ",    x:8,  y:10,icon:"⛏",income:1000},
  {id:"canada_r",name:"カナダ資源",  x:18, y:12,icon:"⛏",income:1000},
  {id:"australia_r",name:"豪州資源", x:136,y:68,icon:"⛏",income:1000},
  {id:"caspian", name:"カスピ海",    x:100,y:24,icon:"⛏",income:1200},
  {id:"nigeria", name:"ナイジェリア",x:76, y:50,icon:"⛏",income:1000},
  {id:"andes",   name:"アンデス",    x:22, y:60,icon:"⛏",income:800},
];

const TITLES=[
  {min:0,      label:"Rookie",    color:"#888"},
  {min:10000,  label:"Soldier",   color:"#44aaff"},
  {min:50000,  label:"Veteran",   color:"#00FF9C"},
  {min:150000, label:"Commander", color:"#FFD700"},
  {min:500000, label:"Legendary", color:"#FF6B35"},
  {min:1000000,label:"Eternal",   color:"#FF2D55"},
];
function getTitle(f){let t=TITLES[0];for(const tt of TITLES)if(f>=tt.min)t=tt;return t;}
const ONBOARD_SLIDES=[
  {t:"目的",b:"勉強した時間を糧にして、世界地図を征服しよう。"},
  {t:"領土拡大",b:"計測した勉強時間に応じて、領土がどんどん広がっていく。"},
  {t:"侵攻",b:"欲しい土地があれば、他の国に攻め込むこともできる（任意）。"},
  {t:"戦闘のルール",b:"勝敗を決めるのは、その戦いに賭けた軍資金の多さ。\n攻める側は、その都度投入する金額を決める。\n守る側は、普段から設定できる防衛費に加えて、攻められるたびに追加の資金を投入できる。"},
];
const UNLOCK={navy:20000,air:50000};
const AIR_RANGE=5;

function nbrs(idx){
  const x=idx%MW,y=Math.floor(idx/MW),r=[];
  if(x>0)r.push(idx-1);if(x<MW-1)r.push(idx+1);
  if(y>0)r.push(idx-MW);if(y<MH-1)r.push(idx+MW);
  return r;
}

function expandTerritory(owned,ni,sx,sy,cells){
  const front=[];
  for(let i=0;i<MW*MH;i++){
    if(owned[i]!==ni)continue;
    for(const nb of nbrs(i))if(RAW_MAP[nb]&&owned[nb]===-1){front.push(nb);break;}
    if(front.length>60)break;
  }
  for(let i=front.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[front[i],front[j]]=[front[j],front[i]];}
  let added=0;const vis=new Set();const q=[...front.slice(0,30)];
  while(q.length&&added<cells){
    const cur=q.shift();if(vis.has(cur))continue;vis.add(cur);
    if(RAW_MAP[cur]&&owned[cur]===-1){
      owned[cur]=ni;added++;
      for(const nb of nbrs(cur))if(!vis.has(nb)&&RAW_MAP[nb]&&owned[nb]===-1)q.push(nb);
    }
  }
  return added;
}

// 領土収益計算（経過時間分）
function calcIncome(nations, owned, lastLoginTime) {
  const now = Date.now();
  const elapsedHours = (now - lastLoginTime) / (1000 * 60 * 60);
  if (elapsedHours < 0.01) return { newNations: nations, incomeLog: [] };
  const incomeLog = [];
  const newNations = nations.map((n, ni) => {
    const tiles = Array.from(owned).filter(v => v === ni).length;
    const tileIncome = Math.floor((tiles / 100) * INCOME_PER_100TILES_PER_HOUR * elapsedHours);
    const poiIncome = POI.filter(p => owned[p.y * MW + p.x] === ni)
      .reduce((s, p) => s + Math.floor(p.income / 24 * elapsedHours), 0);
    const total = tileIncome + poiIncome;
    if (total > 0) incomeLog.push(`${n.name} +${total.toLocaleString()}💰（${elapsedHours.toFixed(1)}時間分の収益）`);
    return total > 0 ? { ...n, fund: n.fund + total } : n;
  });
  return { newNations, incomeLog };
}

function resolveAttack(a, nats, ow) {
  const atkNat = nats[a.attackerIdx];
  const defNat = a.defenderIdx >= 0 ? nats[a.defenderIdx] : null;
  // 防衛力 = 「恒常設定(defenseBudget)」+「この戦闘限定の追加防衛(a.defenseFund)」を、
  // その時点で実際に国が持っている資金(fund)の範囲内で、都度組み立てる。
  // 恒常設定はロック(確保)されているわけではなく、あくまで毎回「宣言」でしかない。
  const intendedDefense = (defNat ? Math.floor(defNat.defenseBudget || 0) : 0) + Math.floor(a.defenseFund || 0);
  const availableFund = defNat ? defNat.fund : 0;
  const defSpent = defNat ? Math.min(intendedDefense, availableFund) : 0; // 実際に投入できた防衛力（資金が足りなければそれが上限）
  const win = a.attackFund > defSpent;
  const newNats = [...nats];
  const newOwned = new Int8Array(ow);
  if (win) {
    newOwned[a.cellIdx] = a.attackerIdx;
    // 防衛側は「投入した防衛力(defSpent)」をそのまま失い、さらに戦利品として追加でその30%を奪われる。
    // 合計損失が保有資金を超えないようクランプする。
    const extraLoot = Math.floor(defSpent * 0.3);
    const totalLoss = defNat ? Math.min(defSpent + extraLoot, defNat.fund) : 0;
    newNats[a.attackerIdx] = { ...newNats[a.attackerIdx], fund: Math.max(0, newNats[a.attackerIdx].fund + extraLoot) };
    if (a.defenderIdx >= 0) newNats[a.defenderIdx] = { ...newNats[a.defenderIdx], fund: Math.max(0, newNats[a.defenderIdx].fund - totalLoss) };
    const poi = POI.find(p => p.x === a.cellIdx % MW && p.y === Math.floor(a.cellIdx / MW));
    return { nations: newNats, owned: newOwned, news: `【制圧】${atkNat?.name}が${defNat ? defNat.name + "の領土" : "未開地"}を制圧！${poi ? ` — ${poi.name}獲得` : ""}` };
  } else {
    // 防衛成功時も、実際に投入した防衛力(defSpent)は「使った」ものとして消費される（略奪はされない）。
    if (a.defenderIdx >= 0 && defSpent > 0) {
      newNats[a.defenderIdx] = { ...newNats[a.defenderIdx], fund: Math.max(0, newNats[a.defenderIdx].fund - defSpent) };
    }
    return { nations: newNats, owned: newOwned, news: `【防衛成功】${defNat?.name || "未開地"}、${atkNat?.name}の侵攻を撃退！` };
  }
}

const CP=[[0,1,0,1,0],[1,1,1,1,1],[1,2,1,2,1],[0,1,1,1,0],[0,1,3,1,0],[0,2,2,2,0]];
function drawCastle(ctx,px,py,col,drk,s){
  CP.forEach((row,dy)=>row.forEach((v,dx)=>{
    if(!v)return;
    ctx.fillStyle=v===1?col:v===2?drk:"#fff";
    ctx.fillRect(px+dx*s,py+dy*s,s,s);
  }));
}
const COLORS=["#00FF9C","#FF6B35","#00B4FF","#CC44FF","#FFD700","#FF2D55","#FF88FF","#88FFFF"];
function mkDark(hex){
  const h=hex.replace("#","");
  return"#"+[0,2,4].map(i=>Math.floor(parseInt(h.slice(i,i+2),16)*.55).toString(16).padStart(2,"0")).join("");
}

function AttackCard({a,atkNat,defNat,hrs,mins,isDefender,onDefend}){
  const [addDefFund,setAddDefFund]=useState("");
  return(
    <div style={{background:"#030d03",border:"1px solid #FF2D5544",borderRadius:6,padding:"10px",marginBottom:8}}>
      <div style={{fontSize:11,marginBottom:4}}>
        <span style={{color:atkNat?.color}}>{atkNat?.name}</span>
        <span style={{color:"#666"}}> → </span>
        <span style={{color:defNat?.color||"#888"}}>{defNat?.name||"未開地"}</span>
      </div>
      <div style={{fontSize:10,color:"#2a5a2a",marginBottom:isDefender?8:0}}>
        残り {hrs}時間{mins}分 | 防衛資金:{(a.defenseFund||0).toLocaleString()}💰
      </div>
      {isDefender&&(
        <div style={{display:"flex",gap:6}}>
          <input type="number" placeholder="上乗せ資金" value={addDefFund} onChange={e=>setAddDefFund(e.target.value)} style={{flex:1,padding:"4px 8px",fontSize:11}}/>
          <button className="btn" style={{padding:"4px 10px",fontSize:11}} onClick={()=>{onDefend(a.id,addDefFund);setAddDefFund("");}}>防衛強化</button>
        </div>
      )}
    </div>
  );
}

export default function App(){
  const cvs=useRef(null);
  const [loaded,setLoaded]=useState(false);
  const [screen,setScreen]=useState("join");
  const [allPlayers,setAllPlayers]=useState([]);
  const [myPlayer,setMyPlayer]=useState(null);
  const [nations,setNations]=useState([]);
  const [owned,setOwned]=useState(()=>new Int8Array(MW*MH).fill(-1));
  const [attacks,setAttacks]=useState([]);
  const [newsLog,setNewsLog]=useState(["【速報】世界大戦、勃発——勉強せよ"]);
  const [zoom,setZoom]=useState(2);
  const [cam,setCam]=useState({x:MW/2,y:MH/2});
  const [hovPoi,setHovPoi]=useState(null);
  const [joinTab,setJoinTab]=useState("returning");
  const [joinName,setJoinName]=useState("");
  const [joinNatId,setJoinNatId]=useState(null);
  const [newNName,setNewNName]=useState("");
  const [newNColor,setNewNColor]=useState("#00FF9C");
  const [pendingNat,setPendingNat]=useState(null);
  const [pendingP,setPendingP]=useState(null);
  const [hoverCell,setHoverCell]=useState(null);
  const [inputH,setInputH]=useState("");
  const [inputM,setInputM]=useState("");
  const [inputSubj,setInputSubj]=useState("");
  const [atkMode,setAtkMode]=useState(false);
  const [atkTarget,setAtkTarget]=useState(null);
  const [atkFund,setAtkFund]=useState("");
  const [defBudget,setDefBudget]=useState("");
  const [syncing,setSyncing]=useState(false);
  const [incomeAlert,setIncomeAlert]=useState(null); // ログイン時収益通知
  const [onboardStep,setOnboardStep]=useState(0);
  const [newPin,setNewPin]=useState("");
  const [resumeTarget,setResumeTarget]=useState(null);
  const [resumePinInput,setResumePinInput]=useState("");
  const [pinError,setPinError]=useState("");
  const [roomCode,setRoomCode]=useState(null);
  const [roomInput,setRoomInput]=useState("");
  const drag=useRef({on:false,sx:0,sy:0,cx:0,cy:0,moved:false});
  const lastSyncRef=useRef(0);

  useEffect(()=>{if(roomCode)loadAll(true);},[roomCode]);
  useEffect(()=>{
    if(!roomCode)return;
    const iv=setInterval(()=>loadAll(false),SYNC_INTERVAL);
    return()=>clearInterval(iv);
  },[roomCode]);

  async function loadAll(isFirstLoad){
    if(!isFirstLoad && Date.now()-lastSyncRef.current < SYNC_INTERVAL-500) return;
    lastSyncRef.current=Date.now();
    const data=await fbGet(roomCode,"");
    if(!data){setLoaded(true);return;}
    let nats=data.nations||[];
    let ow=new Int8Array(data.owned||new Array(MW*MH).fill(-1));
    let nl=data.news||["【速報】世界大戦、勃発——勉強せよ"];
    let pl=data.players||[];
    let atks=data.attacks||[];
    const now=Date.now();

    // 24時間経過した戦闘を解決
    const toResolve=atks.filter(a=>!a.resolved&&now-a.timestamp>=ATTACK_RESOLVE_MS);
    if(toResolve.length>0){
      for(const a of toResolve){
        const result=resolveAttack(a,nats,ow);
        nats=result.nations; ow=result.owned;
        nl=[result.news,...nl.slice(0,49)];
      }
      atks=atks.map(a=>toResolve.find(r=>r.id===a.id)?{...a,resolved:true}:a);
      await fbSet(roomCode,"",{nations:nats,owned:Array.from(ow),news:nl,players:pl,attacks:atks,lastUpdate:now});
    }

    // ログイン時収益（初回ロードのみ）
    if(isFirstLoad && data.lastUpdate){
      const {newNations,incomeLog}=calcIncome(nats,ow,data.lastUpdate);
      if(incomeLog.length>0){
        nats=newNations;
        const incomeNews=incomeLog.map(l=>`【収益】${l}`);
        nl=[...incomeNews,...nl.slice(0,49)];
        setIncomeAlert(incomeLog);
        setTimeout(()=>setIncomeAlert(null),8000);
        await fbSet(roomCode,"",{nations:nats,owned:Array.from(ow),news:nl,players:pl,attacks:atks,lastUpdate:now});
      } else {
        await fbSet(roomCode,"lastUpdate",now);
      }
    }

    setNations(nats);setOwned(ow);setNewsLog(nl);setAllPlayers(pl);setAttacks(atks);
    setLoaded(true);
  }

  async function saveAll(nats,ow,nl,pl,atks){
    setSyncing(true);
    await fbSet(roomCode,"",{nations:nats,owned:Array.from(ow),news:nl.slice(0,50),players:pl,attacks:atks||[],lastUpdate:Date.now()});
    setSyncing(false);
  }

  function addNewsAndSave(msg,nats,ow,nl,pl,atks){
    const next=[msg,...nl.slice(0,49)];
    setNewsLog(next);
    saveAll(nats,ow,next,pl,atks||attacks);
    return next;
  }

  function getPoiOwner(ow){
    const res={};
    POI.forEach(p=>{const o=ow[p.y*MW+p.x];if(o>=0)res[p.id]=o;});
    return res;
  }

  function placeNation(sx,sy){
    if(!pendingNat||!pendingP)return;
    const nat={...pendingNat,sx,sy};
    const newNats=[...nations,nat];
    const ni=newNats.length-1;
    const newO=new Int8Array(owned);
    const start=sy*MW+sx;
    if(RAW_MAP[start]){
      newO[start]=ni;
      const q=[start];let a=1;
      while(q.length&&a<5){const cur=q.shift();for(const nb of nbrs(cur)){if(RAW_MAP[nb]&&newO[nb]===-1){newO[nb]=ni;q.push(nb);a++;if(a>=5)break;}}}
    }
    const near=POI.find(c=>Math.abs(c.x-sx)<10&&Math.abs(c.y-sy)<10);
    const newPlayers=[...allPlayers.filter(p=>p.name!==pendingP.name),pendingP];
    setAllPlayers(newPlayers);setNations(newNats);setOwned(newO);
    addNewsAndSave(`【建国】${nat.name}、${near?near.name+"付近":"未知の地"}に建国`,newNats,newO,newsLog,newPlayers);
    setMyPlayer(pendingP);
    setPendingNat(null);setPendingP(null);setHoverCell(null);
    setCam({x:sx,y:sy});setZoom(4);setOnboardStep(0);setScreen("onboarding");
  }

  function handleJoin(){
    if(!joinName.trim())return;
    if(joinTab==="new"){
      if(!newNName.trim())return;
      const ex=nations.find(n=>n.name===newNName.trim());
      if(ex){doJoin(ex);return;}
      const nat={id:`n_${Date.now()}`,name:newNName.trim(),color:newNColor,dark:mkDark(newNColor),sx:0,sy:0,fund:0,totalFund:0,navy:false,air:false,defenseBudget:0};
      const p={name:joinName.trim(),nationId:nat.id,totalFund:0,pin:newPin.trim()||null};
      setPendingNat(nat);setPendingP(p);
      setCam({x:MW/2,y:MH/2});setZoom(1.5);setScreen("placing");
    } else if(joinTab==="existing"){
      if(!joinNatId)return;
      const nat=nations.find(n=>n.id===joinNatId);
      if(nat)doJoin(nat);
    }
  }

  function resumePlayer(p){
    setMyPlayer(p);
    const nat=nations.find(n=>n.id===p.nationId);
    if(nat){setCam({x:nat.sx,y:nat.sy});setZoom(4);}
    setResumeTarget(null);setResumePinInput("");setPinError("");
    setScreen("map");
  }

  function requestResume(p){
    // 暗証番号未設定（旧データ等）の場合は、そのまま入れる
    if(!p.pin){resumePlayer(p);return;}
    setResumeTarget(p);setResumePinInput("");setPinError("");
  }

  function confirmResume(){
    if(!resumeTarget)return;
    if(resumePinInput===resumeTarget.pin){resumePlayer(resumeTarget);}
    else{setPinError("暗証番号が違います");}
  }

  function doJoin(nat){
    const p={name:joinName.trim(),nationId:nat.id,totalFund:0,pin:newPin.trim()||null};
    const newPlayers=[...allPlayers.filter(x=>x.name!==p.name),p];
    setAllPlayers(newPlayers);setMyPlayer(p);
    addNewsAndSave(`【参戦】${p.name} → ${nat.name}`,nations,owned,newsLog,newPlayers);
    setCam({x:nat.sx,y:nat.sy});setZoom(4);setOnboardStep(0);setScreen("onboarding");
  }

  async function submitStudy(){
    const h=parseInt(inputH||"0"),m=parseInt(inputM||"0");
    const total=h*60+m;if(!total||!myPlayer)return;
    const earned=Math.floor(total*FUND_PER_MIN);
    const cells=Math.max(1,Math.floor(total/MINS_PER_CELL));
    const ni=nations.findIndex(n=>n.id===myPlayer.nationId);
    if(ni<0)return;
    const nat=nations[ni];
    const newO=new Int8Array(owned);
    const added=expandTerritory(newO,ni,nat.sx,nat.sy,cells);
    const newTF=(myPlayer.totalFund||0)+earned;
    const newNats=nations.map((n,i)=>i===ni?{...n,fund:n.fund+earned,totalFund:(n.totalFund||0)+earned}:n);
    const newPlayers=allPlayers.map(p=>p.name===myPlayer.name?{...p,totalFund:newTF}:p);
    setOwned(newO);setNations(newNats);setAllPlayers(newPlayers);
    setMyPlayer(prev=>({...prev,totalFund:newTF}));
    const subj=inputSubj?`[${inputSubj}]`:"";
    addNewsAndSave(`【拡張】${nat.name}${subj} +${added}マス（${h}h${m}m / +${earned.toLocaleString()}💰）`,newNats,newO,newsLog,newPlayers);
    setInputH("");setInputM("");setInputSubj("");
    setScreen("map");setCam({x:nat.sx,y:nat.sy});
  }

  async function setDefenseBudget(){
    const budget=parseInt(defBudget||"0");
    const ni=nations.findIndex(n=>n.id===myPlayer?.nationId);
    if(ni<0)return;
    const newNats=nations.map((n,i)=>i===ni?{...n,defenseBudget:budget}:n);
    setNations(newNats);
    await saveAll(newNats,owned,newsLog,allPlayers,attacks);
    setDefBudget("");
  }

  async function declareAttack(){
    const fund=parseInt(atkFund||"0");
    if(!fund||fund<=0||!atkTarget||!myPlayer)return;
    const ni=nations.findIndex(n=>n.id===myPlayer.nationId);
    if(ni<0)return;
    const myNatData=nations[ni];
    if(myNatData.fund<fund){alert("資金不足");return;}
    const newNats=nations.map((n,i)=>i===ni?{...n,fund:n.fund-fund}:n);
    const newAtk={
      id:`atk_${Date.now()}`,
      attackerIdx:ni,
      defenderIdx:atkTarget.ownerIdx,
      cellIdx:atkTarget.idx,
      attackFund:fund,
      defenseFund:0,
      timestamp:Date.now(),
      resolved:false,
    };
    const newAtks=[...attacks,newAtk];
    setNations(newNats);setAttacks(newAtks);
    const defName=atkTarget.ownerIdx>=0?nations[atkTarget.ownerIdx]?.name:"未開地";
    addNewsAndSave(`【侵攻宣言】${myNatData.name}が${defName}に侵攻宣言！24時間以内に決着`,newNats,owned,newsLog,allPlayers,newAtks);
    setAtkMode(false);setAtkTarget(null);setAtkFund("");
  }

  async function addDefense(atkId,addFund){
    const fund=parseInt(addFund||"0");
    if(!fund||!myPlayer)return;
    const ni=nations.findIndex(n=>n.id===myPlayer.nationId);
    if(ni<0)return;
    const myNatData=nations[ni];
    if(myNatData.fund<fund){alert("資金不足");return;}
    const newNats=nations.map((n,i)=>i===ni?{...n,fund:n.fund-fund}:n);
    const newAtks=attacks.map(a=>a.id===atkId?{...a,defenseFund:(a.defenseFund||0)+fund}:a);
    setNations(newNats);setAttacks(newAtks);
    await saveAll(newNats,owned,newsLog,allPlayers,newAtks);
  }

  async function unlockMilitary(type){
    const ni=nations.findIndex(n=>n.id===myPlayer?.nationId);
    if(ni<0)return;
    const cost=type==="navy"?UNLOCK.navy:UNLOCK.air;
    if(nations[ni].fund<cost)return;
    const newNats=nations.map((n,i)=>i===ni?{...n,fund:n.fund-cost,[type]:true}:n);
    setNations(newNats);
    addNewsAndSave(`【解放】${nations[ni].name}、${type==="navy"?"⚓海軍":"✈️空軍"}を創設！`,newNats,owned,newsLog,allPlayers);
  }

  function getAttackable(ni,nats,ow){
    const myNatData=nats[ni];
    const attackable=new Set();
    for(let i=0;i<MW*MH;i++){
      if(ow[i]!==ni)continue;
      for(const nb of nbrs(i)){
        if(RAW_MAP[nb]&&ow[nb]!==ni)attackable.add(nb);
      }
    }
    if(myNatData?.navy){
      for(let i=0;i<MW*MH;i++){
        if(ow[i]!==ni)continue;
        const hasSeaNb=nbrs(i).some(nb=>!RAW_MAP[nb]);
        if(hasSeaNb){
          const x0=i%MW,y0=Math.floor(i/MW);
          for(let dy=-15;dy<=15;dy++) for(let dx=-15;dx<=15;dx++){
            const nx=x0+dx,ny=y0+dy;
            if(nx<0||nx>=MW||ny<0||ny>=MH)continue;
            const nidx=ny*MW+nx;
            if(RAW_MAP[nidx]&&ow[nidx]!==ni)attackable.add(nidx);
          }
        }
      }
    }
    if(myNatData?.air){
      for(let i=0;i<MW*MH;i++){
        if(ow[i]!==ni)continue;
        const x0=i%MW,y0=Math.floor(i/MW);
        for(let dy=-AIR_RANGE;dy<=AIR_RANGE;dy++) for(let dx=-AIR_RANGE;dx<=AIR_RANGE;dx++){
          if(Math.abs(dx)+Math.abs(dy)>AIR_RANGE)continue;
          const nx=x0+dx,ny=y0+dy;
          if(nx<0||nx>=MW||ny<0||ny>=MH)continue;
          const nidx=ny*MW+nx;
          if(RAW_MAP[nidx]&&ow[nidx]!==ni)attackable.add(nidx);
        }
      }
    }
    return attackable;
  }

  const myNat=myPlayer?nations.find(n=>n.id===myPlayer.nationId):null;
  const myNatIdx=myNat?nations.findIndex(n=>n.id===myNat.id):-1;
  const myTerritory=myNatIdx>=0?Array.from(owned).filter(v=>v===myNatIdx).length:0;
  const poiOwner=getPoiOwner(owned);
  const myPOIs=myNatIdx>=0?POI.filter(p=>poiOwner[p.id]===myNatIdx):[];
  const myTitle=myPlayer?getTitle(myPlayer.totalFund||0):null;
  const attackable=atkMode&&myNatIdx>=0?getAttackable(myNatIdx,nations,owned):new Set();
  const pendingAtks=attacks.filter(a=>!a.resolved&&a.defenderIdx===myNatIdx);

  useEffect(()=>{
    if(!cvs.current||(screen!=="map"&&screen!=="placing"))return;
    const canvas=cvs.current;
    const ctx=canvas.getContext("2d");
    const W=canvas.width,H=canvas.height;
    const s=CELL*zoom,ox=W/2-cam.x*s,oy=H/2-cam.y*s;
    ctx.fillStyle="#030d14";ctx.fillRect(0,0,W,H);
    for(let y=0;y<MH;y++) for(let x=0;x<MW;x++){
      const idx=y*MW+x,px=ox+x*s,py=oy+y*s;
      if(px<-s||px>W||py<-s||py>H)continue;
      if(!RAW_MAP[idx]){ctx.fillStyle=(x+y)%4===0?"#071824":"#030d14";ctx.fillRect(px,py,s,s);continue;}
      const o=owned[idx];
      if(o===-1)ctx.fillStyle=screen==="placing"&&hoverCell===idx?"#ffffff55":(x+y)%2===0?"#1c1c1c":"#141414";
      else{const n=nations[o];ctx.fillStyle=n?(x+y)%2===0?n.color+"cc":n.dark+"dd":"#333";}
      ctx.fillRect(px,py,s,s);
    }
    for(let y=0;y<MH;y++) for(let x=0;x<MW;x++){
      const idx=y*MW+x;if(owned[idx]<0)continue;
      const px=ox+x*s,py=oy+y*s;
      if(px<-s||px>W||py<-s||py>H)continue;
      const col=nations[owned[idx]]?.color||"#fff";
      if(x<MW-1&&owned[idx+1]!==owned[idx]){ctx.fillStyle=col+"88";ctx.fillRect(px+s-1,py,1,s);}
      if(y<MH-1&&owned[(y+1)*MW+x]!==owned[idx]){ctx.fillStyle=col+"88";ctx.fillRect(px,py+s-1,s,1);}
    }
    if(atkMode){
      attackable.forEach(idx=>{
        const x=idx%MW,y=Math.floor(idx/MW);
        const px=ox+x*s,py=oy+y*s;
        if(px<-s||px>W||py<-s||py>H)return;
        ctx.fillStyle="#FF2D5555";ctx.fillRect(px,py,s,s);
        ctx.strokeStyle="#FF2D55aa";ctx.lineWidth=0.5;ctx.strokeRect(px,py,s,s);
      });
    }
    if(s>=4)nations.forEach((n,i)=>{
      const px=ox+n.sx*s,py=oy+n.sy*s;
      if(px<-s*6||px>W+s*6||py<-s*6||py>H+s*6)return;
      const cs=Math.max(2,Math.floor(s*.9));
      drawCastle(ctx,px-cs*2,py-cs*3,n.color,n.dark,cs);
      if(s>3){
        ctx.font=`bold ${Math.max(7,Math.floor(s*1.1))}px monospace`;
        ctx.fillStyle=n.color;ctx.shadowColor="#000";ctx.shadowBlur=3;
        ctx.fillText(n.name,px-cs*2,py+cs*4);ctx.shadowBlur=0;
      }
    });
    if(s>=2){
      REGION_LABELS.forEach(l=>{
        const px=ox+l.x*s,py=oy+l.y*s;
        if(px<0||px>W||py<0||py>H)return;
        ctx.font=`${Math.max(8,Math.floor(s*1.2))}px monospace`;
        ctx.fillStyle="#ffffff18";ctx.shadowBlur=0;
        ctx.fillText(l.name,px,py);
      });
    }
    POI.forEach(p=>{
      const px=ox+p.x*s,py=oy+p.y*s;
      if(px<-s*2||px>W+s*2||py<-s*2||py>H+s*2)return;
      const owner=poiOwner[p.id]!==undefined?nations[poiOwner[p.id]]:null;
      const fs=Math.max(10,Math.floor(s*1.4));
      ctx.beginPath();ctx.arc(px+s/2,py+s/2,fs*.7,0,Math.PI*2);
      ctx.fillStyle=owner?owner.color+"44":"#ffffff18";ctx.fill();
      ctx.font=`${fs}px serif`;ctx.fillText(p.icon,px,py+fs*.9);
      if(s>3){
        ctx.font=`bold ${Math.max(6,Math.floor(s*.85))}px monospace`;
        ctx.fillStyle=owner?owner.color+"cc":"#ffffff55";
        ctx.fillText(p.name,px+fs*.8,py+fs*.5);
      }
      if(s>6&&hovPoi===p.id){
        const label=`${p.name} +${p.income.toLocaleString()}💰/日`;
        const tw=ctx.measureText(label).width+16;
        ctx.fillStyle="#000000dd";ctx.fillRect(px,py-30,tw,22);
        ctx.fillStyle=owner?owner.color:"#fff";
        ctx.font=`bold ${Math.max(9,Math.floor(s*.9))}px monospace`;
        ctx.fillText(label,px+8,py-14);
      }
    });
    if(screen==="placing"){
      ctx.fillStyle="#00000088";ctx.fillRect(0,0,W,44);
      ctx.fillStyle="#00FF9C";ctx.font="bold 14px monospace";
      ctx.fillText(`🏰 ${pendingNat?.name} の拠点を陸地クリックで選択`,16,28);
    }
    ctx.fillStyle=syncing?"#FFD70022":"#00FF9C22";ctx.fillRect(W-95,H-22,88,14);
    ctx.fillStyle=syncing?"#FFD700":"#00FF9C99";ctx.font="9px monospace";
    ctx.fillText(syncing?"● SYNCING":` x${zoom.toFixed(1)} ● LIVE`,W-90,H-11);
  },[owned,nations,zoom,cam,screen,hoverCell,pendingNat,poiOwner,hovPoi,atkMode,attackable,syncing]);

  function getCellFromMouse(e){
    const rect=cvs.current.getBoundingClientRect();
    const s=CELL*zoom,W=cvs.current.width,H=cvs.current.height;
    const ox=W/2-cam.x*s,oy=H/2-cam.y*s;
    const cx=Math.floor((e.clientX-rect.left-ox)/s),cy=Math.floor((e.clientY-rect.top-oy)/s);
    if(cx<0||cx>=MW||cy<0||cy>=MH)return null;
    return{x:cx,y:cy,idx:cy*MW+cx};
  }
  function getPOIFromMouse(e){
    const rect=cvs.current.getBoundingClientRect();
    const s=CELL*zoom,W=cvs.current.width,H=cvs.current.height;
    const ox=W/2-cam.x*s,oy=H/2-cam.y*s;
    const mx=e.clientX-rect.left,my=e.clientY-rect.top;
    for(const p of POI){
      const px=ox+p.x*s,py=oy+p.y*s,r=s*1.5;
      if(mx>=px-r&&mx<=px+r*2&&my>=py-r&&my<=py+r*2)return p;
    }
    return null;
  }
  const onWheel=e=>{e.preventDefault();setZoom(z=>Math.max(0.5,Math.min(8,z-e.deltaY*.004)));};
  const onMD=e=>{drag.current={on:true,sx:e.clientX,sy:e.clientY,cx:cam.x,cy:cam.y,moved:false};};
  const onMM=e=>{
    if(!drag.current.on)return;
    const dx=e.clientX-drag.current.sx,dy=e.clientY-drag.current.sy;
    if(Math.abs(dx)>3||Math.abs(dy)>3)drag.current.moved=true;
    setCam({x:drag.current.cx-dx/(CELL*zoom),y:drag.current.cy-dy/(CELL*zoom)});
    if(screen==="placing"){const c=getCellFromMouse(e);setHoverCell(c&&RAW_MAP[c.idx]?c.idx:null);}
    const poi=getPOIFromMouse(e);setHovPoi(poi?poi.id:null);
  };
  const onMU=e=>{
    if(!drag.current.on)return;
    const moved=drag.current.moved;drag.current.on=false;
    if(moved)return;
    if(screen==="placing"){const c=getCellFromMouse(e);if(c&&RAW_MAP[c.idx])placeNation(c.x,c.y);return;}
    if(atkMode){
      const c=getCellFromMouse(e);
      if(!c||!RAW_MAP[c.idx])return;
      if(!attackable.has(c.idx))return;
      setAtkTarget({x:c.x,y:c.y,idx:c.idx,ownerIdx:owned[c.idx]});
    }
  };

  // --- スマホのタッチ操作対応（1本指:ドラッグ/タップ、2本指:ピンチズーム） ---
  const pinchRef = useRef({ dist: null });
  const onTouchStart = e => {
    if (e.touches.length === 1) {
      const t = e.touches[0];
      onMD({ clientX: t.clientX, clientY: t.clientY });
    } else if (e.touches.length === 2) {
      const [a, b] = e.touches;
      pinchRef.current.dist = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
      drag.current.on = false;
    }
  };
  const onTouchMove = e => {
    e.preventDefault();
    if (e.touches.length === 1 && drag.current.on) {
      const t = e.touches[0];
      onMM({ clientX: t.clientX, clientY: t.clientY });
    } else if (e.touches.length === 2) {
      const [a, b] = e.touches;
      const dist = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
      const prev = pinchRef.current.dist;
      if (prev) {
        const delta = dist - prev;
        setZoom(z => Math.max(0.5, Math.min(8, z + delta * 0.01)));
      }
      pinchRef.current.dist = dist;
    }
  };
  const onTouchEnd = e => {
    if (e.touches.length === 0) {
      const t = e.changedTouches[0];
      if (t) onMU({ clientX: t.clientX, clientY: t.clientY });
      pinchRef.current.dist = null;
    } else if (e.touches.length === 1) {
      pinchRef.current.dist = null;
      const t = e.touches[0];
      drag.current = { on: true, sx: t.clientX, sy: t.clientY, cx: cam.x, cy: cam.y, moved: true };
    }
  };

  const css=`
    *{box-sizing:border-box}body{margin:0}
    .app-shell{height:100vh}
    @supports (height: 100dvh){ .app-shell{height:100dvh} }
    @keyframes slide{from{opacity:0;transform:translateY(-6px)}to{opacity:1;transform:translateY(0)}}
    @keyframes ticker{0%{transform:translateX(100%)}100%{transform:translateX(-200%)}}
    @keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}}
    @keyframes incomepop{0%{opacity:0;transform:translateY(20px)}10%{opacity:1;transform:translateY(0)}80%{opacity:1}100%{opacity:0;transform:translateY(-10px)}}
    .nb{background:transparent;border:1px solid #1a3a1a;color:#4a7a4a;border-radius:4px;padding:5px 12px;cursor:pointer;font-family:monospace;font-size:11px;font-weight:bold;transition:all 0.15s;letter-spacing:1px}
    .nb:hover,.nb.on{border-color:#00FF9C;color:#00FF9C;background:#00FF9C11}
    .btn{background:transparent;border:1px solid #00FF9C55;color:#00FF9C;border-radius:3px;padding:8px 18px;cursor:pointer;font-family:monospace;font-size:12px;font-weight:bold;transition:all 0.15s}
    .btn:hover{background:#00FF9C22;border-color:#00FF9C}
    .btn:disabled{opacity:0.3;cursor:not-allowed}
    .btn.red{border-color:#FF2D5555;color:#FF2D55}.btn.red:hover{background:#FF2D5522}
    .btn.gold{border-color:#FFD70055;color:#FFD700}.btn.gold:hover{background:#FFD70022}
    .panel{background:#050f05;border:1px solid #1a3a1a;border-radius:6px;padding:14px}
    input[type=text],input[type=number],input[type=password]{background:#050f05;border:1px solid #1a3a1a;color:#00FF9C;border-radius:3px;padding:8px 10px;font-family:monospace;font-size:13px;outline:none;width:100%}
    input:focus{border-color:#00FF9C}
    ::-webkit-scrollbar{width:4px}::-webkit-scrollbar-track{background:#050f05}::-webkit-scrollbar-thumb{background:#1a3a1a}
  `;

  const canvasWrapRef = useRef(null);
  const [canvasSize, setCanvasSize] = useState({ w: 800, h: 600 });

  useEffect(() => {
    function measure() {
      const el = canvasWrapRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const w = Math.max(1, Math.floor(rect.width));
      const h = Math.max(1, Math.floor(rect.height));
      setCanvasSize(prev => (prev.w === w && prev.h === h ? prev : { w, h }));
    }
    measure();
    // モバイルSafari等ではURLバーの表示/非表示でビューポートが変化するため、
    // resize/orientationchangeに加えて、少し遅延させた再計測も行う（レイアウト確定待ち）
    window.addEventListener('resize', measure);
    window.addEventListener('orientationchange', measure);
    const t1 = setTimeout(measure, 100);
    const t2 = setTimeout(measure, 400);
    return () => {
      window.removeEventListener('resize', measure);
      window.removeEventListener('orientationchange', measure);
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [screen, atkMode, atkTarget]);

  function genRoomCode(){
    const chars="ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let c="";
    for(let i=0;i<6;i++)c+=chars[Math.floor(Math.random()*chars.length)];
    return c;
  }

  if(!roomCode)return(
    <div style={{minHeight:"100vh",background:"#020902",fontFamily:"monospace",color:"#00FF9C",display:"flex",alignItems:"center",justifyContent:"center",padding:16}}>
      <style>{css}</style>
      <div style={{width:"100%",maxWidth:440}}>
        <div style={{textAlign:"center",marginBottom:20}}>
          <div style={{fontSize:26,fontWeight:900,letterSpacing:6,marginBottom:4}}>STUDYTOON</div>
          <div style={{fontSize:9,color:"#2a5a2a",letterSpacing:3}}>どの戦場（部屋）で戦うか選べ</div>
        </div>
        <div className="panel" style={{marginBottom:14}}>
          <div style={{fontSize:10,color:"#2a5a2a",marginBottom:10,letterSpacing:2}}>// 友人・学校の部屋に参加する</div>
          <div style={{display:"flex",gap:8}}>
            <input type="text" placeholder="部屋コードを入力（例：AB3XQ9）" value={roomInput}
              onChange={e=>setRoomInput(e.target.value.toUpperCase())}
              onKeyDown={e=>{if(e.key==="Enter"&&roomInput.trim())setRoomCode(roomInput.trim());}}/>
            <button className="btn" style={{padding:"8px 16px",fontSize:12}}
              disabled={!roomInput.trim()} onClick={()=>setRoomCode(roomInput.trim())}>▶ 参加</button>
          </div>
          <div style={{fontSize:10,color:"#2a5a2a",marginTop:8,lineHeight:1.7}}>友達・学校のグループから共有されたコードを入力してください。</div>
        </div>
        <div style={{textAlign:"center",fontSize:10,color:"#2a5a2a",margin:"10px 0",letterSpacing:2}}>─── または ───</div>
        <div className="panel">
          <div style={{fontSize:10,color:"#2a5a2a",marginBottom:10,letterSpacing:2}}>// 新しい戦場を開く</div>
          <button className="btn gold" style={{width:"100%",fontSize:13,padding:"12px"}}
            onClick={()=>setRoomCode(genRoomCode())}>🏰 新規の部屋を作る</button>
          <div style={{fontSize:10,color:"#2a5a2a",marginTop:8,lineHeight:1.7}}>部屋を作ると、専用のコードが発行されます。友達・志望校仲間にそのコードを共有すれば、同じ地図で戦えます。</div>
        </div>
      </div>
    </div>
  );

  if(!loaded)return(
    <div style={{height:"100vh",background:"#020902",display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"monospace",color:"#00FF9C",flexDirection:"column",gap:12}}>
      <div style={{fontSize:28,fontWeight:900,letterSpacing:6}}>STUDYTOON</div>
      <div style={{fontSize:9,color:"#FFD700",letterSpacing:2,marginBottom:4}}>部屋: {roomCode}</div>
      <div style={{fontSize:11,color:"#2a5a2a",animation:"pulse 1s infinite"}}>Firebaseに接続中...</div>
      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.3}}`}</style>
    </div>
  );

  if(screen==="join")return(
    <div style={{minHeight:"100vh",background:"#020902",fontFamily:"monospace",color:"#00FF9C",display:"flex",alignItems:"center",justifyContent:"center",padding:16}}>
      <style>{css}</style>
      <div style={{width:"100%",maxWidth:480}}>
        <div style={{textAlign:"center",marginBottom:20}}>
          <div style={{fontSize:26,fontWeight:900,letterSpacing:6,marginBottom:4}}>STUDYTOON</div>
          <div style={{fontSize:9,color:"#2a5a2a",letterSpacing:3}}>WORLD DOMINATION LEARNING SYSTEM</div>
        </div>
        <div style={{display:"flex",gap:6,marginBottom:14}}>
          {[["returning","👤 再ログイン"],["existing","🌍 国に参加"],["new","🏰 建国する"]].map(([t,l])=>(
            <button key={t} className={`nb ${joinTab===t?"on":""}`} style={{flex:1,fontSize:10}} onClick={()=>setJoinTab(t)}>{l}</button>
          ))}
        </div>
        {joinTab==="returning"&&(
          <div className="panel">
            <div style={{fontSize:10,color:"#2a5a2a",marginBottom:12,letterSpacing:2}}>// 前回の指揮官を選択</div>
            {allPlayers.length===0
              ?<div style={{color:"#2a5a2a",fontSize:11,textAlign:"center",padding:"16px 0"}}>まだ参加履歴がありません</div>
              :allPlayers.map(p=>{
                const n=nations.find(x=>x.id===p.nationId);
                const isTarget=resumeTarget?.name===p.name;
                return(
                  <div key={p.name}>
                    <button onClick={()=>requestResume(p)} style={{background:"#030d03",border:`2px solid ${isTarget?(n?.color||"#00FF9C"):(n?.color||"#1a3a1a")+"44"}`,borderRadius:6,padding:"12px 14px",cursor:"pointer",textAlign:"left",display:"flex",alignItems:"center",gap:10,width:"100%",marginBottom:isTarget?6:8}}>
                      {n&&<div style={{width:10,height:10,background:n.color,borderRadius:2,flexShrink:0}}/>}
                      <div>
                        <div style={{fontSize:13,fontWeight:900,color:n?.color||"#00FF9C"}}>{p.name}</div>
                        <div style={{fontSize:10,color:"#2a5a2a",marginTop:2}}>{n?.name||"不明"} | {getTitle(p.totalFund||0).label}{p.pin?" | 🔒":""}</div>
                      </div>
                      <div style={{marginLeft:"auto",fontSize:10,color:"#2a5a2a"}}>{p.pin?"▶ 暗証番号入力":"▶ 再開"}</div>
                    </button>
                    {isTarget&&(
                      <div style={{display:"flex",gap:6,marginBottom:8,paddingLeft:2}}>
                        <input type="password" placeholder="暗証番号" value={resumePinInput}
                          onChange={e=>{setResumePinInput(e.target.value);setPinError("");}}
                          onKeyDown={e=>{if(e.key==="Enter")confirmResume();}}
                          style={{flex:1}} autoFocus/>
                        <button className="btn" style={{padding:"8px 14px",fontSize:12}} onClick={confirmResume}>▶</button>
                      </div>
                    )}
                    {isTarget&&pinError&&<div style={{fontSize:10,color:"#FF2D55",marginBottom:8,paddingLeft:2}}>{pinError}</div>}
                  </div>
                );
              })
            }
          </div>
        )}
        {joinTab==="existing"&&(
          <div>
            <div className="panel" style={{marginBottom:10}}>
              <div style={{fontSize:10,color:"#2a5a2a",marginBottom:8}}>// 指揮官名</div>
              <input type="text" placeholder="名前を入力..." value={joinName} onChange={e=>setJoinName(e.target.value)} style={{marginBottom:12}}/>
              <div style={{fontSize:10,color:"#2a5a2a",marginBottom:8}}>// 暗証番号（他人のなりすまし防止・任意）</div>
              <input type="password" placeholder="4桁程度の数字など" value={newPin} onChange={e=>setNewPin(e.target.value)}/>
            </div>
            <div className="panel" style={{marginBottom:14}}>
              <div style={{fontSize:10,color:"#2a5a2a",marginBottom:8}}>// 国家選択（場所・戦力は参加後に公開）</div>
              {nations.length===0
                ?<div style={{color:"#2a5a2a",fontSize:11,textAlign:"center",padding:"12px"}}>まだ国家がありません</div>
                :nations.map(n=>{
                  const sel=joinNatId===n.id;
                  return(
                    <button key={n.id} onClick={()=>setJoinNatId(n.id)} style={{background:sel?n.color+"22":"#030d03",border:`2px solid ${sel?n.color:n.color+"44"}`,borderRadius:6,padding:"10px 14px",cursor:"pointer",textAlign:"left",display:"flex",alignItems:"center",gap:10,width:"100%",marginBottom:8}}>
                      <div style={{width:10,height:10,background:n.color,borderRadius:2}}/>
                      <span style={{fontSize:12,fontWeight:900,color:n.color}}>{n.name}</span>
                      {sel&&<span style={{marginLeft:"auto",fontSize:10,color:n.color}}>▶</span>}
                    </button>
                  );
                })
              }
            </div>
            <button className="btn" style={{width:"100%",fontSize:14,padding:"13px"}} onClick={handleJoin}
              disabled={!joinName.trim()||!joinNatId||nations.length===0}>▶ 参戦する</button>
          </div>
        )}
        {joinTab==="new"&&(
          <div>
            <div className="panel" style={{marginBottom:10}}>
              <div style={{fontSize:10,color:"#2a5a2a",marginBottom:8}}>// 指揮官名</div>
              <input type="text" placeholder="名前を入力..." value={joinName} onChange={e=>setJoinName(e.target.value)} style={{marginBottom:12}}/>
              <div style={{fontSize:10,color:"#2a5a2a",marginBottom:8}}>// 暗証番号（他人のなりすまし防止・任意）</div>
              <input type="password" placeholder="4桁程度の数字など" value={newPin} onChange={e=>setNewPin(e.target.value)}/>
            </div>
            <div className="panel" style={{marginBottom:14}}>
              <div style={{fontSize:10,color:"#2a5a2a",marginBottom:10}}>// 国家設立</div>
              <input type="text" placeholder="国家名（例：京大解放戦線）" value={newNName} onChange={e=>setNewNName(e.target.value)} style={{marginBottom:12}}/>
              <div style={{fontSize:10,color:"#2a5a2a",marginBottom:6}}>国家カラー</div>
              <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:10}}>
                {COLORS.map(c=><button key={c} onClick={()=>setNewNColor(c)} style={{width:26,height:26,background:c,border:newNColor===c?"3px solid #fff":"3px solid transparent",borderRadius:3,cursor:"pointer"}}/>)}
              </div>
            </div>
            <button className="btn" style={{width:"100%",fontSize:14,padding:"13px"}} onClick={handleJoin}
              disabled={!joinName.trim()||!newNName.trim()}>🏰 建国して拠点を選ぶ</button>
          </div>
        )}
      </div>
    </div>
  );

  if(screen==="onboarding")return(
    <div style={{minHeight:"100vh",background:"#020902",fontFamily:"monospace",color:"#00FF9C",display:"flex",alignItems:"center",justifyContent:"center",padding:16}}>
      <style>{css}</style>
      <div style={{width:"100%",maxWidth:460}}>
        <div style={{textAlign:"center",marginBottom:18}}>
          <div style={{fontSize:9,color:"#FFD700",letterSpacing:3,marginBottom:6}}>// {onboardStep+1} / {ONBOARD_SLIDES.length}</div>
          <div style={{display:"flex",gap:4,justifyContent:"center"}}>
            {ONBOARD_SLIDES.map((_,i)=>(
              <div key={i} style={{width:i===onboardStep?18:6,height:4,borderRadius:2,background:i===onboardStep?"#FFD700":"#1a3a1a",transition:"all 0.2s"}}/>
            ))}
          </div>
        </div>
        <div className="panel" style={{border:"1px solid #FFD70044",marginBottom:16,minHeight:140,display:"flex",flexDirection:"column",justifyContent:"center"}}>
          <div style={{fontSize:16,fontWeight:900,color:"#FFD700",letterSpacing:2,marginBottom:12,textAlign:"center"}}>
            {ONBOARD_SLIDES[onboardStep].t}
          </div>
          <div style={{fontSize:13,color:"#00FF9C",lineHeight:2,whiteSpace:"pre-line",textAlign:"center"}}>
            {ONBOARD_SLIDES[onboardStep].b}
          </div>
        </div>
        <div style={{display:"flex",gap:8}}>
          <button className="nb" style={{flex:1}} onClick={()=>setScreen("record")}>スキップ</button>
          {onboardStep<ONBOARD_SLIDES.length-1
            ?<button className="btn gold" style={{flex:2,fontSize:13,padding:"11px"}} onClick={()=>setOnboardStep(s=>s+1)}>次へ ▶</button>
            :<button className="btn gold" style={{flex:2,fontSize:13,padding:"11px"}} onClick={()=>setScreen("record")}>はじめる ▶</button>
          }
        </div>
      </div>
    </div>
  );

  return(
    <div className="app-shell" style={{background:"#020902",fontFamily:"monospace",color:"#00FF9C",display:"flex",flexDirection:"column",overflow:"hidden"}}>
      <style>{css}</style>
      <div style={{position:"fixed",inset:0,background:"repeating-linear-gradient(0deg,transparent,transparent 2px,rgba(0,255,156,0.01) 2px,rgba(0,255,156,0.01) 4px)",pointerEvents:"none",zIndex:999}}/>

      {/* ログイン時収益ポップアップ */}
      {incomeAlert&&(
        <div style={{position:"fixed",bottom:80,right:20,zIndex:9999,animation:"incomepop 8s ease forwards"}}>
          <div style={{background:"#0a1f0a",border:"2px solid #FFD700",borderRadius:10,padding:"12px 16px",maxWidth:280}}>
            <div style={{fontSize:11,color:"#FFD700",fontWeight:900,marginBottom:6}}>💰 収益が入りました！</div>
            {incomeAlert.map((l,i)=><div key={i} style={{fontSize:10,color:"#00FF9C",lineHeight:1.6}}>{l}</div>)}
          </div>
        </div>
      )}

      <div style={{background:"#030d03",borderBottom:"1px solid #1a3a1a",padding:"6px 14px",display:"flex",alignItems:"center",justifyContent:"space-between",flexShrink:0}}>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <span style={{fontSize:13,fontWeight:900,letterSpacing:4}}>STUDYTOON</span>
          <span style={{fontSize:9,color:"#FFD700",border:"1px solid #FFD70044",borderRadius:3,padding:"2px 6px",letterSpacing:1}}>部屋:{roomCode}</span>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          {pendingAtks.length>0&&<span style={{fontSize:10,color:"#FF2D55",animation:"pulse 1s infinite"}}>⚠️ 侵攻を受けています！</span>}
          {myTitle&&<span style={{fontSize:10,color:myTitle.color,fontWeight:900}}>{myTitle.label}</span>}
          {myNat&&<span style={{fontSize:10,color:myNat.color}}>[{myPlayer.name}] {myNat.name} | 💰{myNat.fund.toLocaleString()}</span>}
          {syncing&&<span style={{fontSize:9,color:"#FFD700",animation:"pulse 1s infinite"}}>SYNC</span>}
        </div>
      </div>

      <div style={{background:"#0a0500",borderBottom:"1px solid #332200",padding:"4px 0",overflow:"hidden",flexShrink:0}}>
        <div style={{animation:"ticker 40s linear infinite",whiteSpace:"nowrap",fontSize:11,color:"#FFD700"}}>
          {[...newsLog,...newsLog].map((n,i)=><span key={i} style={{marginRight:48}}>◆ {n}</span>)}
        </div>
      </div>

      {screen!=="placing"&&(
        <div style={{background:"#030d03",borderBottom:"1px solid #1a3a1a",padding:"5px 14px",display:"flex",gap:6,flexShrink:0,flexWrap:"wrap"}}>
          {[["map","[ MAP ]"],["record","[ 記録 ]"],["military","[ 軍事 ]"],["rank","[ RANK ]"],["news","[ NEWS ]"],["help","[ HELP ]"]].map(([s,l])=>(
            <button key={s} className={`nb ${screen===s?"on":""}`} onClick={()=>setScreen(s)}>{l}</button>
          ))}
          {screen==="map"&&<>
            <button className={`nb ${atkMode?"on":""}`} style={{borderColor:"#FF2D5544",color:atkMode?"#FF2D55":"#884444"}} onClick={()=>{setAtkMode(v=>!v);setAtkTarget(null);}}>[ ⚔️侵攻 ]</button>
            <button className="nb" onClick={()=>{setCam({x:myNat?.sx||MW/2,y:myNat?.sy||MH/2});setZoom(4);}}>[ 自国 ]</button>
            <button className="nb" onClick={()=>{setCam({x:MW/2,y:MH/2});setZoom(1.5);}}>[ 全体 ]</button>
          </>}
          <button className="nb" style={{marginLeft:"auto"}} onClick={()=>setScreen("join")}>指揮官切替</button>
          <button className="nb" style={{borderColor:"#FFD70044",color:"#887700"}} onClick={()=>{setRoomCode(null);setLoaded(false);setScreen("join");setMyPlayer(null);}}>部屋を変える</button>
        </div>
      )}

      {atkMode&&atkTarget&&screen==="map"&&(
        <div style={{background:"#1a0505",borderBottom:"2px solid #FF2D55",padding:"8px 14px",display:"flex",alignItems:"center",gap:10,flexShrink:0,flexWrap:"wrap"}}>
          <span style={{fontSize:11,color:"#FF2D55"}}>⚔️ {atkTarget.ownerIdx>=0?nations[atkTarget.ownerIdx]?.name:"未開地"} への侵攻</span>
          <input type="number" placeholder="投入資金" value={atkFund} onChange={e=>setAtkFund(e.target.value)} style={{width:130,padding:"4px 8px",fontSize:12}}/>
          <button className="btn red" style={{padding:"5px 14px",fontSize:12}} onClick={declareAttack}>侵攻宣言（24h後解決）</button>
          <button className="nb" onClick={()=>{setAtkTarget(null);setAtkFund("");}}>×</button>
          <span style={{fontSize:10,color:"#2a5a2a"}}>残金:{myNat?.fund.toLocaleString()}💰</span>
        </div>
      )}

      <div style={{flex:1,display:"grid",gridTemplateColumns:screen==="placing"?"1fr":"1fr 220px",overflow:"hidden"}}>
        <div ref={canvasWrapRef} style={{overflow:"hidden",position:"relative",width:"100%",height:"100%"}}>
          {(screen==="map"||screen==="placing")&&(
            <canvas ref={cvs}
              width={canvasSize.w}
              height={canvasSize.h}
              style={{display:"block",width:canvasSize.w+"px",height:canvasSize.h+"px",touchAction:"none",cursor:screen==="placing"?"crosshair":atkMode?"crosshair":"grab"}}
              onWheel={onWheel} onMouseDown={onMD} onMouseMove={onMM}
              onMouseUp={onMU} onMouseLeave={()=>{drag.current.on=false;setHoverCell(null);setHovPoi(null);}}
              onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}
            />
          )}

          {screen==="record"&&(
            <div style={{padding:20,overflowY:"auto",height:"100%"}}>
              <div style={{fontSize:10,color:"#2a5a2a",marginBottom:14,letterSpacing:2}}>// 勉強時間申告</div>
              <div className="panel" style={{marginBottom:12}}>
                <div style={{display:"flex",gap:10,marginBottom:12,alignItems:"center"}}>
                  <div style={{flex:1}}>
                    <input type="number" placeholder="0" min="0" value={inputH} onChange={e=>setInputH(e.target.value)}/>
                    <div style={{fontSize:10,color:"#2a5a2a",textAlign:"center",marginTop:3}}>時間</div>
                  </div>
                  <span style={{color:"#2a5a2a",fontSize:18}}>:</span>
                  <div style={{flex:1}}>
                    <input type="number" placeholder="0" min="0" max="59" value={inputM} onChange={e=>setInputM(e.target.value)}/>
                    <div style={{fontSize:10,color:"#2a5a2a",textAlign:"center",marginTop:3}}>分</div>
                  </div>
                </div>
                <input type="text" placeholder="科目（任意）" value={inputSubj} onChange={e=>setInputSubj(e.target.value)} style={{marginBottom:12}}/>
                <div style={{fontSize:10,color:"#2a5a2a",marginBottom:12,background:"#030d03",border:"1px solid #1a3a1a",borderRadius:4,padding:"8px 10px",lineHeight:1.9}}>
                  1時間 = 1,000💰 = 1マス拡張<br/>
                  海軍:20,000💰 | 空軍:50,000💰
                </div>
                <button className="btn" style={{width:"100%",fontSize:14,padding:"12px"}} onClick={submitStudy}
                  disabled={!parseInt(inputH||"0")&&!parseInt(inputM||"0")}>
                  📚 申告 → 領土拡大！
                </button>
              </div>
              {myNat&&(
                <div className="panel" style={{marginBottom:12}}>
                  <div style={{fontSize:10,color:"#2a5a2a",marginBottom:8}}>STATUS</div>
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6,marginBottom:myPOIs.length?10:0}}>
                    {[["NAME",myPlayer.name],["NATION",myNat.name],["FUNDS",`${myNat.fund.toLocaleString()}💰`],["TERRITORY",`${myTerritory}マス`],["称号",myTitle?.label||"-"],["累計",`${(myPlayer.totalFund||0).toLocaleString()}💰`]].map(([k,v])=>(
                      <div key={k} style={{background:"#030d03",border:"1px solid #1a3a1a",borderRadius:3,padding:"7px"}}>
                        <div style={{fontSize:9,color:"#2a5a2a"}}>{k}</div>
                        <div style={{fontSize:11,marginTop:2,color:k==="NATION"?myNat.color:k==="称号"?(myTitle?.color||"#00FF9C"):"#00FF9C"}}>{v}</div>
                      </div>
                    ))}
                  </div>
                  {myPOIs.length>0&&(
                    <div>
                      <div style={{fontSize:10,color:"#2a5a2a",marginBottom:6}}>支配中の重要地点</div>
                      {myPOIs.map(p=>(
                        <div key={p.id} style={{display:"flex",justifyContent:"space-between",fontSize:11,padding:"4px 0",borderBottom:"1px solid #1a2a1a"}}>
                          <span>{p.icon} {p.name}</span>
                          <span style={{color:"#FFD700"}}>+{p.income.toLocaleString()}💰/日</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
              {myNat&&(
                <div className="panel">
                  <div style={{fontSize:10,color:"#2a5a2a",marginBottom:8}}>🛡 防衛予算</div>
                  <div style={{fontSize:10,color:"#5a8a5a",marginBottom:8}}>現在: {(myNat.defenseBudget||0).toLocaleString()}💰（侵攻時に自動防衛）</div>
                  <div style={{display:"flex",gap:8}}>
                    <input type="number" placeholder="防衛予算" value={defBudget} onChange={e=>setDefBudget(e.target.value)} style={{flex:1}}/>
                    <button className="btn" style={{padding:"8px 14px",fontSize:12}} onClick={setDefenseBudget}>設定</button>
                  </div>
                </div>
              )}
            </div>
          )}

          {screen==="military"&&(()=>{
            const touchesSea=myNatIdx>=0?(()=>{for(let i=0;i<MW*MH;i++){if(owned[i]!==myNatIdx)continue;if(nbrs(i).some(nb=>!RAW_MAP[nb]))return true;}return false;})():false;
            return(
            <div style={{padding:20,overflowY:"auto",height:"100%"}}>
              <div style={{fontSize:10,color:"#2a5a2a",marginBottom:14,letterSpacing:2}}>// 軍事システム</div>
              {[
                {type:"army",label:"🗡 陸軍",desc:"隣接マスへの侵攻のみ",unlocked:true,cost:0,note:null},
                {type:"navy",label:"⚓ 海軍",desc:"海に面した領土から、半径15マス内を攻撃可能",unlocked:myNat?.navy||false,cost:UNLOCK.navy,
                  note: myNat?.navy ? (touchesSea?{ok:true,text:"現在、海に接する領土あり。効果が発動しています"}:{ok:false,text:"⚠️ 現在、海に接する領土がありません。海に届くまで、まだ効果を発揮できません"}) : {ok:null,text:"※ 効果を発揮するには、自国の領土が海（地図の陸地の外側）に接している必要があります"}},
                {type:"air", label:"✈️ 空軍",desc:`自国のどの領土からでも、半径${AIR_RANGE}マス内を攻撃可能`,unlocked:myNat?.air||false,cost:UNLOCK.air,note:null},
              ].map(m=>(
                <div key={m.type} className="panel" style={{marginBottom:12,border:`1px solid ${m.unlocked?"#00FF9C44":"#1a3a1a"}`}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
                    <span style={{fontSize:15,fontWeight:900}}>{m.label}</span>
                    <span style={{fontSize:10,color:m.unlocked?"#00FF9C":"#2a5a2a"}}>{m.unlocked?"✓ 解放済み":`${m.cost.toLocaleString()}💰`}</span>
                  </div>
                  <div style={{fontSize:11,color:"#5a8a5a",marginBottom:m.unlocked?0:10}}>{m.desc}</div>
                  {m.note&&(
                    <div style={{fontSize:10,color:m.note.ok===false?"#FF2D55":m.note.ok===true?"#00FF9C":"#2a5a2a",marginTop:6,lineHeight:1.6}}>{m.note.text}</div>
                  )}
                  {!m.unlocked&&myNat&&(
                    <button className="btn gold" style={{width:"100%",fontSize:12,padding:"8px",marginTop:m.note?8:0}}
                      onClick={()=>unlockMilitary(m.type)} disabled={myNat.fund<m.cost}>
                      {myNat.fund>=m.cost?"解放する":"資金不足"} ({myNat.fund.toLocaleString()}/{m.cost.toLocaleString()}💰)
                    </button>
                  )}
                </div>
              ))}
              {attacks.filter(a=>!a.resolved).length>0&&(
                <div className="panel">
                  <div style={{fontSize:10,color:"#FF2D55",marginBottom:10,letterSpacing:2}}>⚔️ 進行中の戦闘</div>
                  {attacks.filter(a=>!a.resolved).map(a=>{
                    const atkNat=nations[a.attackerIdx];
                    const defNat=a.defenderIdx>=0?nations[a.defenderIdx]:null;
                    const remaining=Math.max(0,ATTACK_RESOLVE_MS-(Date.now()-a.timestamp));
                    const hrs=Math.floor(remaining/3600000);
                    const mins=Math.floor((remaining%3600000)/60000);
                    return <AttackCard key={a.id} a={a} atkNat={atkNat} defNat={defNat} hrs={hrs} mins={mins} isDefender={a.defenderIdx===myNatIdx} onDefend={addDefense}/>;
                  })}
                </div>
              )}
            </div>
            );
          })()}

          {screen==="rank"&&(
            <div style={{padding:20,overflowY:"auto",height:"100%"}}>
              <div style={{fontSize:10,color:"#2a5a2a",marginBottom:12,letterSpacing:2}}>// 世界支配率ランキング</div>
              <div style={{display:"flex",flexDirection:"column",gap:8,marginBottom:20}}>
                {[...nations].map((n,i)=>({n,i,t:Array.from(owned).filter(v=>v===i).length}))
                  .sort((a,b)=>b.t-a.t).map(({n,i,t},rank)=>{
                  const pct=(t/Math.max(1,LAND_IDX.length)*100).toFixed(2);
                  const pois=POI.filter(p=>poiOwner[p.id]===i);
                  const dailyIncome=pois.reduce((s,p)=>s+p.income,0)+Math.floor(t/100)*INCOME_PER_100TILES_PER_HOUR*24;
                  return(
                    <div key={n.id} className="panel" style={{border:`1px solid ${rank===0?n.color+"88":"#1a3a1a"}`}}>
                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
                        <div style={{display:"flex",alignItems:"center",gap:8}}>
                          <span style={{fontSize:15,fontWeight:900,color:rank===0?"#FFD700":"#2a5a2a"}}>#{rank+1}</span>
                          <div style={{width:8,height:8,background:n.color}}/>
                          <span style={{color:n.color,fontSize:12}}>{n.name}</span>
                          {n.navy&&<span style={{fontSize:9,color:"#00B4FF"}}>⚓</span>}
                          {n.air&&<span style={{fontSize:9,color:"#FFD700"}}>✈️</span>}
                        </div>
                        <div style={{textAlign:"right"}}>
                          <div style={{color:"#FFD700",fontSize:13,fontWeight:900}}>{pct}%</div>
                          <div style={{color:"#2a5a2a",fontSize:10}}>💰{n.fund.toLocaleString()} +{dailyIncome.toLocaleString()}/日</div>
                        </div>
                      </div>
                      <div style={{background:"#030d03",height:5,borderRadius:2,overflow:"hidden",marginBottom:pois.length?6:0}}>
                        <div style={{width:`${Math.min(100,parseFloat(pct)*5)}%`,height:"100%",background:n.color,transition:"width 0.8s"}}/>
                      </div>
                      {pois.length>0&&<div style={{fontSize:10,color:"#2a5a2a"}}>{pois.map(p=>p.icon+p.name).join(" · ")}</div>}
                    </div>
                  );
                })}
              </div>
              <div style={{fontSize:10,color:"#2a5a2a",marginBottom:10,letterSpacing:2}}>// 称号</div>
              {myPlayer&&(()=>{
                const cur=(myPlayer.totalFund||0);
                const idx=TITLES.findIndex(t=>t.label===(myTitle?.label));
                const next=TITLES[idx+1];
                return next?(
                  <div className="panel" style={{marginBottom:10,border:`1px solid ${myTitle.color}66`}}>
                    <div style={{fontSize:10,color:"#2a5a2a",marginBottom:6}}>次の称号「{next.label}」まで</div>
                    <div style={{fontSize:13,fontWeight:900,color:next.color,marginBottom:6}}>あと {(next.min-cur).toLocaleString()}💰</div>
                    <div style={{background:"#030d03",height:5,borderRadius:2,overflow:"hidden"}}>
                      <div style={{width:`${Math.min(100,((cur-TITLES[idx].min)/(next.min-TITLES[idx].min))*100)}%`,height:"100%",background:next.color,transition:"width 0.8s"}}/>
                    </div>
                  </div>
                ):(
                  <div className="panel" style={{marginBottom:10,border:`1px solid ${myTitle?.color}66`}}>
                    <div style={{fontSize:12,color:myTitle?.color,fontWeight:900}}>最高位「{myTitle?.label}」に到達済み</div>
                  </div>
                );
              })()}
              {TITLES.map(t=>{
                const isCur=myTitle?.label===t.label;
                return(
                  <div key={t.label} style={{display:"flex",justifyContent:"space-between",background:isCur?t.color+"22":"#050f05",border:`1px solid ${isCur?t.color:"#1a3a1a"}`,borderRadius:4,padding:"6px 12px",marginBottom:4}}>
                    <span style={{fontSize:12,fontWeight:900,color:t.color}}>{isCur&&"▶ "}{t.label}</span>
                    <span style={{fontSize:10,color:"#2a5a2a"}}>{t.min.toLocaleString()}💰〜</span>
                  </div>
                );
              })}
            </div>
          )}

          {screen==="news"&&(
            <div style={{padding:20,overflowY:"auto",height:"100%"}}>
              <div style={{fontSize:10,color:"#2a5a2a",marginBottom:12,letterSpacing:2}}>// WORLD NEWS</div>
              {newsLog.map((n,i)=>(
                <div key={i} style={{background:"#050f05",border:`1px solid ${i===0?"#FFD70066":"#1a3a1a"}`,borderRadius:6,padding:"10px 14px",fontSize:12,color:i===0?"#FFD700":"#6a8a6a",lineHeight:1.6,marginBottom:8,animation:i===0?"slide 0.3s ease":"none"}}>{n}</div>
              ))}
            </div>
          )}

          {screen==="help"&&(
            <div style={{padding:20,overflowY:"auto",height:"100%"}}>
              <div style={{fontSize:10,color:"#2a5a2a",marginBottom:16,letterSpacing:2}}>// HOW TO PLAY</div>
              {[
                {t:"🎯 目的",b:"勉強時間を資金に変えて世界地図を支配せよ。世界支配率1位の国家が覇者！"},
                {t:"📚 勉強→資金",b:"[ 記録 ]で申告。\n1時間=1,000💰=1マス拡張"},
                {t:"💰 領土収益",b:"ログインするたびに前回からの経過時間分の収益が自動で入る。\n毎日ログインするほど有利！\n🏙大都市〜2,000💰/日\n⚓海峡〜1,800💰/日\n⛏資源〜1,500💰/日"},
                {t:"⚔️ 戦闘",b:"MAPで[ ⚔️侵攻 ]をON→赤いマスをクリック。\n資金を入力して侵攻宣言→24時間後に自動解決。\n防衛側は[ 軍事 ]タブで防衛強化できる。"},
                {t:"🛡 防衛予算",b:"[ 記録 ]タブで設定。\n侵攻を受けたとき自動で使われる。\nログインできない日も守られる！"},
                {t:"🗡⚓✈️ 軍種",b:"陸軍：隣接マスのみ\n海軍：20,000💰、海越え半径15マス\n空軍：50,000💰、射程5マスの遠距離"},
                {t:"🗺️ 操作",b:"スクロール:ズーム / ドラッグ:移動\n[ 自国 ][ 全体 ]"},
              ].map(({t,b})=>(
                <div key={t} className="panel" style={{marginBottom:10}}>
                  <div style={{fontSize:13,fontWeight:900,marginBottom:6}}>{t}</div>
                  <div style={{fontSize:11,color:"#5a8a5a",lineHeight:1.8,whiteSpace:"pre-line"}}>{b}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        {screen!=="placing"&&(
          <div style={{borderLeft:"1px solid #1a3a1a",background:"#030d03",display:"flex",flexDirection:"column",overflow:"hidden"}}>
            <div style={{padding:"7px 12px",borderBottom:"1px solid #332200",fontSize:10,color:"#887700",letterSpacing:2}}>// LIVE NEWS</div>
            <div style={{flex:1,overflowY:"auto",padding:"8px 10px",display:"flex",flexDirection:"column",gap:5}}>
              {newsLog.map((n,i)=>(
                <div key={i} style={{fontSize:10,color:i===0?"#FFD700":"#443300",lineHeight:1.7,paddingBottom:4,borderBottom:"1px solid #1a1000",animation:i===0?"slide 0.3s ease":"none"}}>{n}</div>
              ))}
            </div>
            {myNat&&(
              <div style={{padding:"10px",borderTop:"1px solid #1a3a1a"}}>
                <div style={{fontSize:9,color:"#2a5a2a",marginBottom:3}}>MY NATION</div>
                <div style={{color:myNat.color,fontWeight:900,fontSize:12,marginBottom:2}}>{myNat.name}</div>
                <div style={{color:myTitle?.color,fontSize:10,marginBottom:2}}>{myTitle?.label}</div>
                <div style={{color:"#2a5a2a",fontSize:10}}>💰{myNat.fund.toLocaleString()}</div>
                <div style={{color:"#2a5a2a",fontSize:10}}>{myTerritory}マス | {myPOIs.length}拠点</div>
                {myNat.navy&&<div style={{fontSize:10,color:"#00B4FF"}}>⚓海軍保有</div>}
                {myNat.air&&<div style={{fontSize:10,color:"#FFD700"}}>✈️空軍保有</div>}
              </div>
            )}
            <div style={{padding:"6px 8px",borderTop:"1px solid #1a3a1a",display:"flex",gap:4}}>
              <button className="nb" style={{flex:1,padding:"4px",fontSize:10}} onClick={()=>setZoom(z=>Math.min(8,+(z+.5).toFixed(1)))}>[ + ]</button>
              <button className="nb" style={{flex:1,padding:"4px",fontSize:10}} onClick={()=>setZoom(z=>Math.max(0.5,+(z-.5).toFixed(1)))}>[ - ]</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
