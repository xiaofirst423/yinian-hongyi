/* 李叔同纪念馆游客图谱。正式数据与稳定 ID 保持原样。 */
(() => {
  'use strict';
  const app = document.getElementById('app');
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const fmt = n => n.toLocaleString('zh-CN');
  let cachedData, cleanup, renderVersion = 0;
  const colors = {Person:'#0d6871', FamilyGroup:'#8b6641', Organization:'#ad814a', Place:'#7d8a60', Work:'#8f6253', Exhibit:'#9b8b79', Event:'#708c99', ExhibitionUnit:'#767397', Concept:'#9b8d49'};
  const categoryNames = {Person:'人物', FamilyGroup:'家族与群体', Organization:'学校与机构', Place:'地点与建筑', Work:'艺术作品', Exhibit:'展陈记录', Event:'生平往事', ExhibitionUnit:'展览单元', Concept:'思想与主题'};
  const icon = name => {
    const paths = {search:'<circle cx="11" cy="11" r="7"/><path d="m16 16 4 4"/>',
      reset:'<path d="M3 11a9 9 0 1 1 3 7M3 4v7h7"/>',
      expand:'<path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5"/>',
      pause:'<path d="M8 5v14M16 5v14"/>', play:'<path d="m8 4 12 8-12 8Z"/>',
      info:'<circle cx="12" cy="12" r="9"/><path d="M12 11v6m0-10v.1"/>',
      close:'<path d="m6 6 12 12M6 18 18 6"/>',
      book:'<path d="M12 6c-3-2-6-2-9-1v14c3-1 6-1 9 1 3-2 6-2 9-1V5c-3-1-6-1-9 1Zm0 0v14"/>'};
    return `<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || ''}</svg>`;
  };

  function header() {
    return `<header class="site-header"><div class="brand"><h1>一念<span>弘一</span></h1><p>李叔同知识图谱<span>人物 · 艺术 · 人生</span></p></div><div class="header-tools" role="group" aria-label="观览工具"><button id="toggle-motion" aria-pressed="false" title="暂停待机浮动">${icon('pause')}<span>静赏</span></button><button id="toggle-detail" aria-controls="graph-detail" aria-expanded="false">${icon('book')}<span>人物资料</span></button><button id="toggle-fullscreen" aria-pressed="false">${icon('expand')}<span>全屏观览</span></button><button id="open-guide" aria-label="使用指引" title="使用指引">${icon('info')}</button></div></header>`;
  }
  function graphTemplate() {
    return `<main id="main-content" class="graph-page"><div id="graph-loading" class="loading" role="status">正在铺开这张关系图谱……</div>
      <div class="graph-workspace" data-detail-collapsed="true" hidden>
        <aside class="filter-panel" aria-label="搜索与筛选">
          <div class="filter-title"><label class="input-label" for="graph-search">寻一人，见万象</label><button id="toggle-filters" class="mobile-only tiny-button" aria-expanded="false" aria-controls="advanced-filters">筛选</button></div>
          <div class="search-box">${icon('search')}<input id="graph-search" type="search" autocomplete="off" placeholder="搜索姓名、作品或别名" aria-controls="search-results"></div>
          <p id="search-summary" class="sr-only" role="status"></p><ul id="search-results" class="search-results"></ul>
          <p class="filter-section-title">循一条线，读一段人生</p>
          <div class="theme-nav" role="group" aria-label="探索主题">
            <button data-theme="people" aria-pressed="true"><span class="theme-number">一</span><span><strong>人物交游</strong><small>亲友、师生与同道</small></span><i aria-hidden="true"></i></button>
            <button data-theme="arts" aria-pressed="false"><span class="theme-number">二</span><span><strong>艺术创作</strong><small>诗文、音乐与书画</small></span><i aria-hidden="true"></i></button>
            <button data-theme="journey" aria-pressed="false"><span class="theme-number">三</span><span><strong>行履足迹</strong><small>走过的地方与往事</small></span><i aria-hidden="true"></i></button>
            <button id="show-overview" data-theme="all" aria-pressed="false"><span class="theme-number">四</span><span><strong>万象全景</strong><small>展开全部人物与故事</small></span><i aria-hidden="true"></i></button>
          </div>
          <div id="advanced-filters" class="advanced-filters">
            <div class="scope-actions"><button id="show-default" class="text-button">${icon('reset')}回到李叔同</button></div>
            <details class="category-filter"><summary>自选探索分类 <span>9 类</span></summary><div class="filter-heading"><span>选择想看的内容</span><div><button data-types="all" class="tiny-button">全选</button><button data-types="none" class="tiny-button">清空</button></div></div><div id="type-filters" class="type-filters"></div></details>
            <p class="filter-note">分类旁的数字为全图收录数量。<br>轻点名字，展开他的故事。</p>
          </div>
        </aside>
        <section class="graph-canvas-wrap" aria-label="交互式知识图谱"><canvas id="graph-canvas" tabindex="0" aria-label="知识图谱。轻点名字查看资料；拖动空白后缓缓归位；滚轮或双指缩放。也可用搜索与关系列表探索。">请使用搜索或人物关系列表探索图谱。</canvas>
          <div class="canvas-top"><p class="section-kicker">一念之间 · 万象相连</p><div id="graph-scope" role="status"></div></div><div id="graph-tooltip" class="graph-tooltip" hidden></div>
          <div class="graph-empty" hidden><strong>此处暂时留白</strong><p>换一种分类，继续寻找人与事物的联系。</p><button class="text-button" id="empty-reset">恢复人物交游 →</button></div>
          <div class="canvas-bottom"><div id="graph-legend" class="graph-legend"></div><div class="graph-controls" role="group" aria-label="图谱视角"><button data-graph-action="zoom-in" aria-label="放大图谱" title="放大">＋</button><button data-graph-action="zoom-out" aria-label="缩小图谱" title="缩小">−</button><button data-graph-action="reset" aria-label="图谱居中复位" title="居中复位">${icon('reset')}</button></div></div>
          <p class="canvas-help"><span>轻点名字查看资料</span><span>拖动空白，松手归位</span><span>滚轮 / 双指缩放</span></p>
        </section>
        <aside id="graph-detail" class="detail-panel" aria-label="人物与事物的资料" hidden></aside>
      </div><p id="viewer-status" class="sr-only" role="status"></p>
      <dialog id="viewer-guide" aria-labelledby="guide-title"><button id="close-guide" class="icon-button guide-close" aria-label="关闭使用指引">${icon('close')}</button><p class="section-kicker">观览指引</p><h2 id="guide-title">循着连线，慢慢读</h2><dl><dt>轻点一个名字</dt><dd>查看人物、作品与往事的资料。名字本身也可以点击。</dd><dt>走近他的世界</dt><dd>在资料中选择“展开相关人物与事物”，也可双击节点，继续向外探索。</dd><dt>移动与缩放</dt><dd>拖动空白，整张图谱会在松手后缓缓归位；拖动单个节点，会牵动相邻节点。滚轮、双指或右下角按钮可缩放。</dd><dt>静下来读</dt><dd>选择“静赏”暂停浮动；“回到李叔同”可重新开始。键盘支持方向键、＋／−、Home 复位和 Enter 展开当前节点。</dd></dl><button id="guide-done" class="primary-button">开始观览</button></dialog>
      <footer class="viewer-footer"><span>一念弘一</span><span>从一人，读一个时代</span></footer></main>`;
  }
  async function render() {
    const version = ++renderVersion;
    cleanup?.(); cleanup = null;
    if (location.hash !== '#/graph') history.replaceState(null,'','#/graph');
    document.body.dataset.route = 'graph';
    app.innerHTML = header() + graphTemplate();
    document.title = '一念弘一 · 李叔同知识图谱';
    try {
      if (!cachedData) {
        const response = await fetch('assets/data/graph-data.json');
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();
        if (!Array.isArray(data.nodes) || !Array.isArray(data.edges) || !data.classes || !data.evidence || !data.defaultNodeIds || !data.nodes.some(n => n.id === data.canonicalNodeId)) throw new Error('图谱文件格式无效');
        cachedData = data;
      }
      if (version !== renderVersion) return;
      document.getElementById('graph-loading').remove();
      document.querySelector('.graph-workspace').hidden = false;
      cleanup = createGraphController(cachedData);
    } catch (error) {
      if (version !== renderVersion) return;
      cachedData = null;
      document.getElementById('graph-loading').innerHTML = `<strong>图谱暂时未能载入</strong><p>请通过项目启动入口打开网站，并确认数据文件完整。</p><small>${esc(error.message)}</small><button id="retry-load" class="primary-button">重新加载</button>`;
      document.getElementById('retry-load').onclick = render;
    }
  }

  function createGraphController(data) {
    const $ = selector => document.querySelector(selector);
    const canvas = $('#graph-canvas'), ctx = canvas.getContext('2d'), detail = $('#graph-detail');
    const byId = new Map(data.nodes.map(n => [n.id, n]));
    const classes = new Map(data.classes.map(c => [c.id, c]));
    const predicates = new Map(data.predicates.map(p => [p.id, p]));
    const attrDefs = new Map(data.attributeDefinitions.map(a => [a.id, a]));
    const adjacency = new Map(data.nodes.map(n => [n.id, []]));
    data.edges.forEach(e => { adjacency.get(e.source).push(e); if (e.target !== e.source) adjacency.get(e.target).push(e); });
    const attributes = new Map(data.nodes.map(n => [n.id, []]));
    data.attributes.forEach(a => attributes.get(a.subject_id).push(a));
    const graph = {mode:'default', center:data.canonicalNodeId, selected:data.canonicalNodeId,
      scope:new Set(), types:new Set(['Person']),
      positions:new Map(), transform:{x:0,y:0,scale:1}, nodes:[], edges:[], hover:null, page:0, theme:'people'};
    let width = 0, height = 0, frame = 0, destroyed = false, pointer = null, gesture = null, labelHits = [];
    const activePointers = new Map();
    const labels = {dirty:true, placements:new Map()};
    const workspace = $('.graph-workspace');
    const narrowScreen = matchMedia('(max-width: 760px)');
    const physics = {links:[], running:false, lastTime:0, quiet:0, elapsed:0};
    const motion = {
      physicsRate:.48, dragFollowMs:140, panFollowMs:100, panGain:.88,
      ambientPeriodMs:20000, ambientAmplitudePx:8, ambientFrameMs:1000/30, paused:false,
      ambientTime:0, renderedTime:0, lastTime:0, lastPaint:0, dirty:true, panTarget:null,
      home:{x:0,y:0}, panReturn:null,
    };
    const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
    const signalController = new AbortController();
    const on = (el, type, listener, options = {}) => el.addEventListener(type, listener, {...options, signal:signalController.signal});
    const typeLabel = id => categoryNames[id] || classes.get(id)?.label || id;
    const predLabel = id => predicates.get(id)?.label || attrDefs.get(id)?.label || id;
    const displayName = node => String(node?.name || '').replace(/\bP\d{4}\b/g,'').replace(/（展陈记录\s*）/g,'（展陈记录）').trim();
    const nameGroups = new Map();
    data.nodes.forEach(n => {
      const key = `${n.type}\0${displayName(n)}`;
      if (!nameGroups.has(key)) nameGroups.set(key, []);
      nameGroups.get(key).push(n.id);
    });
    nameGroups.forEach(ids => ids.sort());
    function entityCaption(n) {
      const group = nameGroups.get(`${n.type}\0${displayName(n)}`);
      return typeLabel(n.type) + (group.length > 1 ? ` · 同名条目 ${group.indexOf(n.id) + 1}` : '');
    }

    $('#type-filters').innerHTML = data.classes.map(c => `<label class="check-row" title="${esc(c.definition)}"><input type="checkbox" data-type="${c.id}" ${c.id === 'Person' ? 'checked' : ''}><span class="legend-dot" style="--dot:${colors[c.id]}"></span><span>${esc(typeLabel(c.id))}</span><small>${data.stats.nodeTypeCounts[c.id]}</small></label>`).join('');
    function neighborhood(id) {
      const ids = new Set([id]);
      adjacency.get(id).forEach(e => {ids.add(e.source); ids.add(e.target);});
      return ids;
    }
    function syncFilters() {
      document.querySelectorAll('[data-type]').forEach(el => el.checked = graph.types.has(el.dataset.type));
      document.querySelectorAll('[data-theme]').forEach(el => el.setAttribute('aria-pressed',String(el.dataset.theme===graph.theme)));
    }
    function refresh() {
      graph.nodes = data.nodes.filter(n => graph.scope.has(n.id) && graph.types.has(n.type));
      const ids = new Set(graph.nodes.map(n => n.id));
      graph.edges = data.edges.filter(e => ids.has(e.source) && ids.has(e.target));
      const themeTitles = {people:'人物交游',arts:'艺术创作',journey:'行履足迹'};
      const title = graph.mode === 'all' ? '万象全景' : graph.mode === 'default' ? `李叔同 · ${themeTitles[graph.theme] || '人与事物'}` : `${displayName(byId.get(graph.center))} · 相关人物与事物`;
      $('#graph-scope').innerHTML = `<strong>${esc(title)}</strong><span><b id="visible-node-count">${graph.nodes.length}</b> ${graph.types.size===1&&graph.types.has('Person')?'位人物':'个人物与事物'}<i>·</i><b id="visible-edge-count">${fmt(graph.edges.length)}</b> 条联系</span>`;
      $('.graph-empty').hidden = graph.nodes.length > 0;
      const types = new Set(graph.nodes.map(n => n.type));
      $('#graph-legend').innerHTML = data.classes.filter(c => types.has(c.id)).map(c => `<span><i class="legend-dot" style="--dot:${colors[c.id]}"></i>${esc(typeLabel(c.id))}</span>`).join('');
      syncFilters(); layout(); scheduleDraw();
    }
    function layout() {
      graph.positions.clear();
      const golden = Math.PI * (3 - Math.sqrt(5));
      if (graph.mode === 'all') {
        const groups = data.classes.map(c => [c.id, graph.nodes.filter(n => n.type === c.id)]).filter(([,nodes]) => nodes.length);
        groups.forEach(([, nodes], i) => {
          const cols = Math.min(3, groups.length), cx = (i % cols - (cols-1)/2) * 430, cy = (Math.floor(i/cols) - (Math.ceil(groups.length/cols)-1)/2) * 400;
          nodes.sort((a,b) => b.degree-a.degree || a.id.localeCompare(b.id));
          nodes.forEach((n,j) => {const r = Math.sqrt(j) * 13; graph.positions.set(n.id,{x:cx+Math.cos(j*golden)*r,y:cy+Math.sin(j*golden)*r});});
        });
      } else {
        if (graph.nodes.some(n => n.id === graph.center)) graph.positions.set(graph.center,{x:0,y:0});
        const other = graph.nodes.filter(n => n.id !== graph.center);
        const groups = data.classes.map(c => other.filter(n => n.type === c.id)).filter(g => g.length);
        let cursor = -Math.PI/2;
        groups.forEach(nodes => {
          nodes.sort((a,b) => b.degree-a.degree || a.name.localeCompare(b.name,'zh-CN') || a.id.localeCompare(b.id));
          const sector = nodes.length / Math.max(1,other.length) * Math.PI*2;
          if (groups.length === 1 && nodes.length <= 80) {
            let placed = 0, ring = 1;
            while (placed < nodes.length) {
              const count = Math.min(12+8*(ring-1),nodes.length-placed), radius = ring*104;
              for(let k=0;k<count;k++) {const a=-Math.PI/2+k/count*Math.PI*2+ring*.16; graph.positions.set(nodes[placed+k].id,{x:Math.cos(a)*radius,y:Math.sin(a)*radius});}
              placed += count; ring++;
            }
          } else {
            nodes.forEach((n,j) => {const r = 115+Math.sqrt(j+.5)*23, a = cursor + sector*(.05+.9*((j*.61803398875)%1)); graph.positions.set(n.id,{x:Math.cos(a)*r,y:Math.sin(a)*r});});
          }
          cursor += sector;
        });
      }
      preparePhysics();
      fit();
    }
    // 浮动仅影响显示坐标。节点力学与整图回位互不混用，不产生累积漂移。
    function preparePhysics() {
      physics.running=false; physics.lastTime=0; physics.quiet=0; physics.elapsed=0;
      pointer=null; gesture=null; activePointers.clear(); motion.panTarget=null; motion.panReturn=null;
      const pairs=new Set(); physics.links=[];
      graph.positions.forEach((p,id)=>{
        let hash=2166136261;
        for(const ch of id)hash=Math.imul(hash^ch.charCodeAt(0),16777619)>>>0;
        Object.assign(p,{ax:p.x,ay:p.y,vx:0,vy:0,fx:0,fy:0,degree:0,
          phase:(hash%10000)/10000*Math.PI*2,
          amplitude:(id===graph.center?.12:.8+(hash%26)/100)*motion.ambientAmplitudePx});
      });
      graph.edges.forEach(e=>{
        if(e.source===e.target)return;
        const key=[e.source,e.target].sort().join(':'); if(pairs.has(key))return; pairs.add(key);
        const a=graph.positions.get(e.source), b=graph.positions.get(e.target);
        a.degree++; b.degree++;
        physics.links.push({a,b,length:Math.max(1,Math.hypot(b.x-a.x,b.y-a.y))});
      });
      graph.positions.forEach(p=>p.mass=Math.sqrt(1+p.degree*.3));
      updateMotionStatus();
    }
    function wakePhysics() {
      physics.running=true; physics.quiet=0; physics.elapsed=0;
      updateMotionStatus(); scheduleDraw();
    }
    function stepPhysics(dt) {
      const pinned=pointer?.moved&&pointer.node ? graph.positions.get(pointer.node.id) : null;
      const bodies=[...graph.positions.values()];
      const spacing=Math.min(42,18/graph.transform.scale), damping=Math.pow(.84,dt);
      bodies.forEach(p=>{p.fx=(p.ax-p.x)*.012;p.fy=(p.ay-p.y)*.012;});
      physics.links.forEach(({a,b,length})=>{
        const dx=b.x-a.x,dy=b.y-a.y,distance=Math.max(.001,Math.hypot(dx,dy));
        const pull=(distance-length)*.055/distance;
        a.fx+=dx*pull; a.fy+=dy*pull; b.fx-=dx*pull; b.fy-=dy*pull;
      });
      // 空间网格只比较附近节点，828 节点全库拖动也无需逐对遍历。
      const cells=new Map();
      bodies.forEach((p,i)=>{const key=`${Math.floor(p.x/spacing)},${Math.floor(p.y/spacing)}`;if(!cells.has(key))cells.set(key,[]);cells.get(key).push(i);});
      bodies.forEach((a,i)=>{
        const cx=Math.floor(a.x/spacing),cy=Math.floor(a.y/spacing);
        for(let ix=cx-1;ix<=cx+1;ix++)for(let iy=cy-1;iy<=cy+1;iy++){
          for(const j of cells.get(`${ix},${iy}`)||[]){
            if(j<=i)continue; const b=bodies[j];let dx=b.x-a.x,dy=b.y-a.y;
            let distance=Math.hypot(dx,dy); if(distance>=spacing)continue;
            if(distance<.001){dx=.01;dy=.01;distance=Math.hypot(dx,dy);}
            const push=(spacing-distance)*.14/distance;
            a.fx-=dx*push;a.fy-=dy*push;b.fx+=dx*push;b.fy+=dy*push;
          }
        }
      });
      let speed=0;
      bodies.forEach(p=>{
        if(p===pinned){p.vx=0;p.vy=0;return;}
        p.vx=(p.vx+p.fx/p.mass*dt)*damping;p.vy=(p.vy+p.fy/p.mass*dt)*damping;
        const magnitude=Math.hypot(p.vx,p.vy);if(magnitude>12){p.vx*=12/magnitude;p.vy*=12/magnitude;}
        p.x+=p.vx*dt;p.y+=p.vy*dt;speed=Math.max(speed,Math.hypot(p.vx,p.vy));
      });
      return speed;
    }
    function advancePhysics(time) {
      const wallMs=physics.lastTime?Math.max(1,Math.min(50,time-physics.lastTime)):16.667;
      const dt=wallMs/16.667*motion.physicsRate;
      physics.lastTime=time;
      const speed=Math.max(stepPhysics(dt/2),stepPhysics(dt/2));
      physics.quiet=speed<.08?physics.quiet+wallMs:0;
      if(!pointer?.node)physics.elapsed+=wallMs;
      if(!pointer?.node&&(physics.quiet>300||physics.elapsed>16000)){
        physics.running=false;physics.lastTime=0;
        graph.positions.forEach(p=>{p.vx=0;p.vy=0;});
      }
    }
    function fit() {
      labels.dirty=true;
      motion.panTarget=null; motion.panReturn=null;
      const rect = canvas.getBoundingClientRect(); width = rect.width; height = rect.height;
      const points = [...graph.positions.values()];
      if (!points.length) {graph.transform = {x:0,y:0,scale:1};motion.home={x:0,y:0};return;}
      const xs = points.map(p=>p.x), ys=points.map(p=>p.y);
      const minX=Math.min(...xs),maxX=Math.max(...xs),minY=Math.min(...ys),maxY=Math.max(...ys);
      const narrow=matchMedia('(max-width: 760px)').matches;
      const top=narrow?190:94, bottom=narrow?100:100, side=narrow?76:110;
      const scale = Math.max(.08,Math.min(1.5,(width-side)/Math.max(160,maxX-minX+55),(height-top-bottom)/Math.max(160,maxY-minY+55)));
      graph.transform = {x:-(minX+maxX)/2*scale,y:-(minY+maxY)/2*scale+(top-bottom)/2,scale};
      motion.home={x:graph.transform.x,y:graph.transform.y};
    }
    function ambientEnabled() {return !reducedMotion.matches && !motion.paused && graph.nodes.length>0;}
    function updateMotionStatus() {
      const active=physics.running||pointer?.moved||gesture||motion.panTarget||motion.panReturn;
      const state=active?'active':ambientEnabled()?'ambient':'idle';
      if(canvas.dataset.motion!==state)canvas.dataset.motion=state;
      const simulation=physics.running?'active':'idle';
      if(canvas.dataset.simulation!==simulation)canvas.dataset.simulation=simulation;
      canvas.dataset.pan=motion.panReturn?'returning':pointer?.moved&&!pointer.node?'dragging':'idle';
    }
    function ambientAmplitude(p) {return reducedMotion.matches?0:narrowScreen.matches?Math.min(2.5,p.amplitude):p.amplitude;}
    function relativeAmplitude(p) {
      // 周边节点以同向舒缓运动为主；仅为差异部分预留碰撞空间，保留更多可读名字。
      const amplitude=ambientAmplitude(p),reference=reducedMotion.matches?0:narrowScreen.matches?2.5:7.4;
      return Math.abs(amplitude-reference)*.75+amplitude*.25;
    }
    function screen(p, ambient=true) {
      const angle=motion.renderedTime/motion.ambientPeriodMs*Math.PI*2;
      const amplitude=ambient?ambientAmplitude(p):0;
      const dx=amplitude*(.75*Math.sin(angle)+.25*Math.sin(angle+p.phase));
      const dy=amplitude*.72*(.75*Math.cos(angle)+.25*Math.cos(angle+p.phase));
      return {x:width/2+graph.transform.x+p.x*graph.transform.scale+dx,
        y:height/2+graph.transform.y+p.y*graph.transform.scale+dy};
    }
    function radius(n) {return n.id === graph.center ? 16 : graph.mode==='all' ? Math.max(3,Math.min(5.5,4*graph.transform.scale)) : graph.nodes.length>80?4.5:6;}
    function labelMetrics(n, active=false) {
      const central=n.id===graph.center,emphasized=central||active;
      const size=central?(narrowScreen.matches?19:21):active?16:narrowScreen.matches?13:14;
      const font=`${emphasized?'600':'400'} ${size}px ${central?'KaiTi, STKaiti, serif':'"Microsoft YaHei", "PingFang SC", sans-serif'}`;
      ctx.font=font;
      const name=displayName(n),limit=emphasized?26:10,label=name.length>limit?name.slice(0,limit-1)+'…':name;
      const lines=emphasized&&label.length>13?[label.slice(0,13),label.slice(13)]:[label];
      return {font,lines,lineHeight:size+5,w:Math.max(...lines.map(line=>ctx.measureText(line).width))+8,h:lines.length*(size+5)};
    }
    function labelBox(side,p,metrics,r) {
      const {w,h}=metrics;
      const [direction,spacing]=side.split(':'),gap=Number(spacing)||8;
      if(direction==='above')return {x:p.x-w/2,y:p.y-r-gap-h,w,h};
      if(direction==='right')return {x:p.x+r+gap+1,y:p.y-h/2,w,h};
      if(direction==='left')return {x:p.x-r-gap-1-w,y:p.y-h/2,w,h};
      if(direction==='above-right')return {x:p.x+r+4,y:p.y-r-4-h,w,h};
      if(direction==='above-left')return {x:p.x-r-4-w,y:p.y-r-4-h,w,h};
      if(direction==='below-right')return {x:p.x+r+4,y:p.y+r+4,w,h};
      if(direction==='below-left')return {x:p.x-r-4-w,y:p.y+r+4,w,h};
      return {x:p.x-w/2,y:p.y+r+gap,w,h};
    }
    function labelSides(n,p) {
      if(n.id===graph.center)return ['below','above','right','left'];
      const dx=p.x-width/2-graph.transform.x,dy=p.y-height/2-graph.transform.y;
      const primary=Math.abs(dx)>Math.abs(dy)*1.5?(dx>0?['right','below','above','left']:['left','below','above','right']):dy<0?['above','below','right','left']:['below','above','right','left'];
      return [...primary,'above-right','above-left','below-right','below-left',...primary.map(side=>side+':22')];
    }
    function placeLabels() {
      labels.placements.clear();labels.dirty=false;
      const overlap=(a,b,pad=4)=>a.x<b.x+b.w+pad&&a.x+a.w+pad>b.x&&a.y<b.y+b.h+pad&&a.y+a.h+pad>b.y;
      const expand=(box,amplitude)=>({x:box.x-amplitude,y:box.y-amplitude*.72,w:box.w+amplitude*2,h:box.h+amplitude*1.44});
      const exclusions=[{x:0,y:0,w:width,h:narrowScreen.matches?184:86},{x:0,y:height-76,w:width,h:76}],occupied=[];
      const ordered=graph.nodes.slice().sort((a,b)=>Number(b.id===graph.center)-Number(a.id===graph.center)||b.degree-a.degree||a.id.localeCompare(b.id));
      const markers=graph.nodes.map(n=>{
        const position=graph.positions.get(n.id),p=screen(position,false),r=radius(n);
        return {id:n.id,box:expand({x:p.x-r-2,y:p.y-r-2,w:r*2+4,h:r*2+4},relativeAmplitude(position))};
      });
      for(const n of ordered){
        if(n.id!==graph.center&&graph.nodes.length>220&&graph.transform.scale<=1.1)continue;
        const position=graph.positions.get(n.id),p=screen(position,false),r=radius(n),metrics=labelMetrics(n);
        const sides=labelSides(n,p),inside=p.x>=0&&p.x<=width&&p.y>=0&&p.y<=height;
        let placement=null;
        for(const side of sides){
          const box=labelBox(side,p,metrics,r),fullEnvelope=expand(box,ambientAmplitude(position)),envelope=expand(box,relativeAmplitude(position));
          if(inside&&(fullEnvelope.x<5||fullEnvelope.x+fullEnvelope.w>width-5))continue;
          if(exclusions.some(other=>overlap(fullEnvelope,other,3)))continue;
          if(occupied.some(other=>overlap(envelope,other,3)))continue;
          if(markers.some(other=>other.id!==n.id&&overlap(envelope,other.box,2)))continue;
          placement=side;occupied.push(envelope);break;
        }
        if(!placement&&n.id===graph.center){placement='below';occupied.push(expand(labelBox(placement,p,metrics,r),relativeAmplitude(position)));}
        if(placement)labels.placements.set(n.id,{side:placement,metrics});
      }
    }
    function drawCompass() {
      ctx.save();ctx.translate(width/2+motion.home.x,height/2+motion.home.y); const r = Math.min(width,height)*.40;
      ctx.strokeStyle='rgba(111,118,96,.10)';ctx.lineWidth=.7;
      [.36,.7,1].forEach(f=>{ctx.beginPath();ctx.arc(0,0,r*f,0,Math.PI*2);ctx.stroke();});
      ctx.restore();
    }
    function draw() {
      if(destroyed)return;
      const dpr = Math.min(devicePixelRatio || 1,2);
      const pixelWidth=Math.round(width*dpr),pixelHeight=Math.round(height*dpr);
      if(canvas.width!==pixelWidth||canvas.height!==pixelHeight){canvas.width=pixelWidth;canvas.height=pixelHeight;}
      ctx.setTransform(dpr,0,0,dpr,0,0);
      ctx.clearRect(0,0,width,height);drawCompass();
      const highlighted = graph.hover || graph.selected;
      const reading=highlighted&&highlighted!==graph.center;
      const connected=new Set([highlighted]);
      if(reading)(adjacency.get(highlighted)||[]).forEach(e=>{connected.add(e.source);connected.add(e.target);});
      graph.edges.forEach(e=>{
        const a=screen(graph.positions.get(e.source)),b=screen(graph.positions.get(e.target));
        const active=e.source===highlighted||e.target===highlighted;
        ctx.strokeStyle=active?'rgba(38,101,103,.32)':reading?'rgba(109,110,92,.08)':graph.mode==='all'?'rgba(109,110,92,.11)':'rgba(109,110,92,.22)';ctx.lineWidth=active?.85:.6;
        ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();
        if(active && graph.transform.scale>.55) {
          const angle=Math.atan2(b.y-a.y,b.x-a.x), end={x:b.x-Math.cos(angle)*(radius(byId.get(e.target))+3),y:b.y-Math.sin(angle)*(radius(byId.get(e.target))+3)};
          ctx.fillStyle='rgba(13,90,98,.48)';ctx.beginPath();ctx.moveTo(end.x,end.y);ctx.lineTo(end.x-Math.cos(angle-.45)*6,end.y-Math.sin(angle-.45)*6);ctx.lineTo(end.x-Math.cos(angle+.45)*6,end.y-Math.sin(angle+.45)*6);ctx.fill();
        }
      });
      const ordered=graph.nodes.slice().sort((a,b)=>(a.id===highlighted)-(b.id===highlighted));
      const visible=[];
      ordered.forEach(n=>{
        const p=screen(graph.positions.get(n.id)),r=radius(n),active=n.id===highlighted||n.id===graph.center;
        if(p.x < -60||p.x>width+60||p.y < -40||p.y>height+40)return;
        ctx.globalAlpha=reading&&!connected.has(n.id)&&n.id!==graph.center?.45:1;
        if(active){ctx.fillStyle=n.id===graph.center?'rgba(152,67,44,.075)':'rgba(13,104,113,.07)';ctx.beginPath();ctx.arc(p.x,p.y,r+8,0,Math.PI*2);ctx.fill();}
        ctx.fillStyle=n.id===graph.center?'#9a4c38':colors[n.type];ctx.strokeStyle='#fff9ee';ctx.lineWidth=2;
        ctx.beginPath();ctx.arc(p.x,p.y,r,0,Math.PI*2);ctx.fill();ctx.stroke();
        if(active) {ctx.strokeStyle=n.id===graph.center?'rgba(152,67,44,.35)':'rgba(13,90,98,.3)';ctx.lineWidth=1;ctx.beginPath();ctx.arc(p.x,p.y,r+5,0,Math.PI*2);ctx.stroke();}
        ctx.globalAlpha=1;
        visible.push({n,p,r,active});
      });
      // 标签布局只在视角或图谱范围变化时计算；待机每帧仅平移，方向和显示名单固定。
      if(labels.dirty)placeLabels();
      visible.sort((a,b)=>Number(a.n.id===highlighted)-Number(b.n.id===highlighted));
      labelHits=[];
      visible.forEach(({n,p,r,active})=>{
        const placement=labels.placements.get(n.id);
        if(!placement&&!active)return;
        const central=n.id===graph.center,metrics=active?labelMetrics(n,true):placement.metrics;
        const side=placement?.side||labelSides(n,screen(graph.positions.get(n.id),false))[0];
        const actual=labelBox(side,p,metrics,r),{lines,lineHeight}=metrics;
        ctx.font=metrics.font;
        if(side.includes(':')){
          const x=Math.max(actual.x,Math.min(p.x,actual.x+actual.w)),y=Math.max(actual.y,Math.min(p.y,actual.y+actual.h));
          const dx=x-p.x,dy=y-p.y,length=Math.max(1,Math.hypot(dx,dy));
          ctx.strokeStyle='rgba(57,107,102,.23)';ctx.lineWidth=.65;ctx.beginPath();ctx.moveTo(p.x+dx/length*(r+3),p.y+dy/length*(r+3));ctx.lineTo(x,y);ctx.stroke();
        }
        ctx.textAlign='center';ctx.textBaseline='middle';ctx.lineJoin='round';ctx.lineWidth=5;
        ctx.strokeStyle='rgba(252,245,232,.96)';ctx.fillStyle=central?'#733c2f':active?'#164f53':'#294d4c';
        ctx.globalAlpha=reading&&!connected.has(n.id)&&!central?.6:1;
        lines.forEach((line,i)=>{const x=actual.x+actual.w/2,y=actual.y+lineHeight*(i+.5);ctx.strokeText(line,x,y);ctx.fillText(line,x,y);});
        ctx.globalAlpha=1;
        labelHits.push({id:n.id,...actual});
      });
      ctx.textBaseline='alphabetic';
    }
    function updateDragFollow(elapsed) {
      if(pointer?.moved&&pointer.node){
        const pos=graph.positions.get(pointer.node.id),blend=1-Math.exp(-elapsed/motion.dragFollowMs);
        pos.x+=(pointer.targetX-pos.x)*blend;pos.y+=(pointer.targetY-pos.y)*blend;
        pos.vx=0;pos.vy=0;
      }
      if(motion.panTarget){
        const blend=1-Math.exp(-elapsed/motion.panFollowMs);
        graph.transform.x+=(motion.panTarget.x-graph.transform.x)*blend;
        graph.transform.y+=(motion.panTarget.y-graph.transform.y)*blend;
      }
      if(motion.panReturn){
        const spring=motion.panReturn;
        spring.delay=Math.max(0,spring.delay-elapsed);
        if(!spring.delay){
          const dt=elapsed/1000,omega=5.8,decay=Math.exp(-omega*dt);
          for(const axis of ['x','y']){
            const velocity=axis==='x'?'vx':'vy',error=graph.transform[axis]-spring[axis],carry=spring[velocity]+omega*error;
            graph.transform[axis]=spring[axis]+(error+carry*dt)*decay;
            spring[velocity]=(spring[velocity]-omega*carry*dt)*decay;
          }
          if(Math.hypot(graph.transform.x-spring.x,graph.transform.y-spring.y)<.08&&Math.hypot(spring.vx,spring.vy)<.5){graph.transform.x=spring.x;graph.transform.y=spring.y;motion.panReturn=null;}
        }
      }
    }
    function returnPan() {
      motion.panTarget=null;
      if(reducedMotion.matches){graph.transform.x=motion.home.x;graph.transform.y=motion.home.y;motion.panReturn=null;}
      else motion.panReturn={...motion.home,vx:0,vy:0,delay:100};
      scheduleDraw();
    }
    function queueFrame(){if(!frame&&!destroyed&&!document.hidden)frame=requestAnimationFrame(animate);}
    function scheduleDraw(){motion.dirty=true;queueFrame();}
    function animate(time) {
      frame=0;if(destroyed||document.hidden)return;
      const elapsed=motion.lastTime?Math.max(0,Math.min(50,time-motion.lastTime)):16.667;
      motion.lastTime=time;
      updateDragFollow(elapsed);
      if(physics.running)advancePhysics(time);
      // 悬停或触摸时停住浮动，方便读字与命中目标；离开后沿原相位继续。
      if(ambientEnabled()&&!graph.hover&&!pointer&&!gesture)motion.ambientTime=(motion.ambientTime+elapsed)%motion.ambientPeriodMs;
      updateMotionStatus();
      const interactive=physics.running||pointer?.moved||gesture||motion.panTarget||motion.panReturn;
      if(motion.dirty||interactive||time-motion.lastPaint>=motion.ambientFrameMs){
        motion.renderedTime=motion.ambientTime;draw();motion.lastPaint=time;motion.dirty=false;
      }
      if(interactive||ambientEnabled())queueFrame();else motion.lastTime=0;
    }
    function nodeAt(x,y) {
      const marker=graph.nodes.slice().sort((a,b)=>(b.id===graph.selected)-(a.id===graph.selected)).find(n=>{const p=screen(graph.positions.get(n.id));return Math.hypot(p.x-x,p.y-y)<Math.max(15,radius(n)+5);});
      if(marker)return marker;
      const hit=labelHits.find(b=>x>=b.x-4&&x<=b.x+b.w+4&&y>=b.y-4&&y<=b.y+b.h+4);
      return hit?byId.get(hit.id):null;
    }
    function qualifier(r){return [r.time_text?`时间：${r.time_text}`:'',r.role?`角色／限定：${r.role}`:''].filter(Boolean).map(esc).join(' · ');}
    function setDetailOpen(open) {
      workspace.dataset.detailCollapsed=String(!open);
      detail.hidden=!open;
      detail.setAttribute('aria-hidden',String(!open));
      $('#toggle-detail').setAttribute('aria-expanded',String(open));
      $('#toggle-detail').setAttribute('aria-label',open?'收起人物资料':'打开人物资料');
      $('#toggle-detail span').textContent=open?'收起资料':'人物资料';
    }
    function selectNode(id, resetPage=true, reveal=true) {
      graph.selected=id;if(resetPage)graph.page=0;
      const n=byId.get(id),rels=adjacency.get(id),attrs=attributes.get(id),pages=Math.max(1,Math.ceil(rels.length/20));
      graph.page=Math.max(0,Math.min(graph.page,pages-1));
      const slice=rels.slice(graph.page*20,graph.page*20+20);
      const birth=attrs.find(a=>a.predicate==='birth_date_text')?.object.match(/\d{4}/)?.[0];
      const death=attrs.find(a=>a.predicate==='death_date_text')?.object.match(/\d{4}/)?.[0];
      const aliases=[...n.searchAliases].sort((a,b)=>Number(['弘一','弘一大师','演音'].includes(b))-Number(['弘一','弘一大师','演音'].includes(a)));
      const attributeOrder=['birth_date_text','death_date_text','role_text','education_idea_text'];
      const sortedAttrs=[...attrs].sort((a,b)=>{const rank=p=>{const i=attributeOrder.indexOf(p);return i<0?99:i;};return rank(a.predicate)-rank(b.predicate);});
      detail.innerHTML=`<div class="detail-overline"><p class="section-kicker">${esc(typeLabel(n.type))} · 资料</p><button data-close-detail class="icon-button" aria-label="收起资料">${icon('close')}</button></div><div class="detail-heading"><h2>${esc(displayName(n))}</h2><div class="detail-caption"><span class="type-badge" style="--dot:${colors[n.type]}">${esc(entityCaption(n))}</span>${birth?`<span class="life-dates">${birth}${death?' — '+death:''}</span>`:''}</div></div>
        <dl class="detail-summary" aria-label="资料概览"><div><dt>相关联系</dt><dd><b>${fmt(rels.length)}</b><span>条</span></dd></div><div><dt>资料摘记</dt><dd><b>${attrs.length}</b><span>则</span></dd></div></dl>
        <button class="detail-focus-button" data-focus="${id}">展开相关人物与事物 <span aria-hidden="true">↗</span></button>
        ${aliases.length?`<section class="alias-section"><h3>亦名</h3><p>${aliases.slice(0,3).map(a=>`<span class="alias-chip">${esc(a)}</span>`).join('')}</p>${aliases.length>3?`<details class="more-aliases"><summary>更多别名 · ${aliases.length-3}</summary><p>${aliases.slice(3).map(a=>`<span class="alias-chip">${esc(a)}</span>`).join('')}</p></details>`:''}</section>`:''}
        ${attrs.length?`<details class="attribute-section"><summary>资料摘记 <small>${attrs.length} 则</small></summary>${sortedAttrs.map(a=>`<div class="attribute-item"><span class="attribute-label">${esc(predLabel(a.predicate).replace(/原文$/,''))}</span><p>${esc(a.object)}</p>${qualifier(a)?`<small>${qualifier(a)}</small>`:''}</div>`).join('')}</details>`:''}
        <section class="relations-section"><h3>循线相识 <small>${rels.length} 条联系</small></h3><p class="detail-note">轻点一条联系，读它的含义，再走近另一个名字。箭头表示关系方向。</p>
        <div class="pagination"><button data-page="prev" ${graph.page===0?'disabled':''} aria-label="上一页关系">←</button><span>第 <b id="relation-page">${graph.page+1}</b> / ${pages} 页</span><button data-page="next" ${graph.page===pages-1?'disabled':''} aria-label="下一页关系">→</button></div>
        <div class="relation-list">${slice.length?slice.map(e=>`<details class="relation-item" data-relation-id="${e.id}"><summary><span class="triple-subject">${esc(displayName(byId.get(e.source)))}</span><span class="triple-predicate">— ${esc(predLabel(e.predicate))} →</span><span class="triple-object">${esc(displayName(byId.get(e.target)))}</span>${qualifier(e)?`<small>${qualifier(e)}</small>`:''}</summary><div class="relation-body"><p class="predicate-definition">${esc(predicates.get(e.predicate).definition)}</p><div class="endpoint-links"><button data-select="${e.source}">走近${esc(displayName(byId.get(e.source)))}</button><button data-select="${e.target}">走近${esc(displayName(byId.get(e.target)))}</button></div></div></details>`).join(''):'<p class="detail-note">暂未收录相关联系。</p>'}</div></section>`;
      if(reveal)setDetailOpen(true);
      if(resetPage)detail.scrollTop=0;
      scheduleDraw();
    }
    function focusAround(id) {
      graph.mode='focus';graph.theme=null;graph.center=id;graph.scope=neighborhood(id);graph.types=new Set(classes.keys());
      refresh();selectNode(id);detail.scrollTop=0;
    }
    function resetDefault() {
      $('#graph-search').value='';$('#search-results').innerHTML='';$('#search-summary').textContent='';
      graph.mode='default';graph.theme='people';graph.center=data.canonicalNodeId;graph.scope=neighborhood(graph.center);graph.types=new Set(['Person']);
      graph.hover=null;$('#graph-tooltip').hidden=true;
      refresh();selectNode(graph.center,true,false);detail.scrollTop=0;
    }
    on($('#show-default'),'click',resetDefault);on($('#empty-reset'),'click',resetDefault);
    document.querySelectorAll('[data-theme]').forEach(el=>on(el,'click',()=>{
      $('#graph-search').value='';$('#search-results').innerHTML='';$('#search-summary').textContent='';
      graph.theme=el.dataset.theme;graph.mode=graph.theme==='all'?'all':'default';graph.center=data.canonicalNodeId;
      graph.scope=graph.mode==='all'?new Set(byId.keys()):neighborhood(graph.center);
      graph.types=graph.theme==='all'?new Set(classes.keys()):new Set(graph.theme==='arts'?['Person','Work','Concept']:graph.theme==='journey'?['Person','Place','Event','Organization']:['Person']);
      // 主题只保留中心人物，避免把全部交游混入作品、足迹主题。
      if(graph.theme==='arts'||graph.theme==='journey')graph.scope=new Set([...graph.scope].filter(id=>id===graph.center||byId.get(id).type!=='Person'));
      graph.hover=null;$('#graph-tooltip').hidden=true;
      refresh();selectNode(graph.center,true,false);workspace.dataset.filtersOpen='false';$('#toggle-filters').setAttribute('aria-expanded','false');
    }));
    on($('#type-filters'),'change',e=>{const el=e.target;if(!el.dataset.type)return;el.checked?graph.types.add(el.dataset.type):graph.types.delete(el.dataset.type);graph.theme=null;refresh();});
    document.querySelectorAll('[data-types]').forEach(el=>on(el,'click',()=>{graph.types=el.dataset.types==='all'?new Set(classes.keys()):new Set();graph.theme=null;refresh();}));
    on($('#graph-search'),'input',e=>{
      const q=e.target.value.trim().toLocaleLowerCase('zh-CN');
      const matches=q?data.nodes.filter(n=>[n.name,...n.searchAliases].some(v=>v.toLocaleLowerCase('zh-CN').includes(q))).sort((a,b)=>Number(b.name===q)-Number(a.name===q)||b.degree-a.degree||a.id.localeCompare(b.id)):[];
      $('#search-summary').textContent=q?`找到 ${matches.length} 个结果`:'';
      $('#search-results').innerHTML=!q?'':matches.length?matches.map(n=>`<li><button data-result="${n.id}"><strong>${esc(displayName(n))}</strong><small>${esc(entityCaption(n))}</small>${n.searchAliases.some(a=>a.includes(e.target.value.trim()))?`<span class="alias-match">别名：${esc(n.searchAliases.filter(a=>a.includes(e.target.value.trim())).join('、'))}</span>`:''}</button></li>`).join(''):'<li class="search-empty">暂未找到，试试姓名、别名或作品名。</li>';
    });
    on($('#search-results'),'click',e=>{const el=e.target.closest('[data-result]');if(!el)return;focusAround(el.dataset.result);$('#search-results').innerHTML='';});
    on($('#graph-search'),'keydown',e=>{if(e.key==='Escape')$('#search-results').innerHTML='';if(e.key==='Enter')$('#search-results button')?.click();if(e.key==='ArrowDown'){$('#search-results button')?.focus();e.preventDefault();}});
    on($('#search-results'),'keydown',e=>{const buttons=[...$('#search-results').querySelectorAll('button')],i=buttons.indexOf(document.activeElement);if(e.key==='Escape'){$('#search-results').innerHTML='';$('#graph-search').focus();}if(['ArrowDown','ArrowUp'].includes(e.key)){e.preventDefault();buttons[(i+(e.key==='ArrowDown'?1:-1)+buttons.length)%buttons.length]?.focus();}});
    on(detail,'click',e=>{
      if(e.target.closest('[data-close-detail]')){setDetailOpen(false);$('#toggle-detail').focus({preventScroll:true});}
      const focus=e.target.closest('[data-focus]');if(focus)focusAround(focus.dataset.focus);
      const select=e.target.closest('[data-select]');if(select){focusAround(select.dataset.select);}
      const page=e.target.closest('[data-page]');if(page&&!page.disabled){graph.page+=page.dataset.page==='next'?1:-1;selectNode(graph.selected,false);detail.querySelector('.relations-section').scrollIntoView({block:'start'});}
    });
    function zoom(factor,x=0,y=0){labels.dirty=true;motion.panTarget=null;motion.panReturn=null;const old=graph.transform.scale,next=Math.max(.07,Math.min(7,old*factor)),ratio=next/old;graph.transform.x=x-(x-graph.transform.x)*ratio;graph.transform.y=y-(y-graph.transform.y)*ratio;graph.transform.scale=next;motion.home={x:graph.transform.x,y:graph.transform.y};scheduleDraw();}
    document.querySelectorAll('[data-graph-action]').forEach(el=>on(el,'click',()=>{const action=el.dataset.graphAction;if(action==='reset'){fit();scheduleDraw();}else zoom(action==='zoom-in'?1.25:.8);}));
    on(canvas,'wheel',e=>{e.preventDefault();const r=canvas.getBoundingClientRect();zoom(e.deltaY<0?1.12:.89,e.clientX-r.left-width/2,e.clientY-r.top-height/2);},{passive:false});
    const localPoint=e=>{const r=canvas.getBoundingClientRect();return {x:e.clientX-r.left,y:e.clientY-r.top};};
    on(canvas,'pointerdown',e=>{
      if(e.button!==0||activePointers.size>=2)return;
      canvas.setPointerCapture(e.pointerId);const p=localPoint(e);activePointers.set(e.pointerId,p);
      motion.panTarget=null;motion.panReturn=null;graph.hover=null;$('#graph-tooltip').hidden=true;
      if(activePointers.size===2){
        const [a,b]=[...activePointers.values()];
        if(pointer?.moved&&pointer.node)wakePhysics();
        pointer=null;gesture={distance:Math.max(1,Math.hypot(a.x-b.x,a.y-b.y)),middle:{x:(a.x+b.x)/2-width/2,y:(a.y+b.y)/2-height/2},transform:{...graph.transform}};
      }else{
        const node=nodeAt(p.x,p.y),pos=node&&graph.positions.get(node.id);
        pointer={...p,id:e.pointerId,originX:p.x,originY:p.y,node,moved:false,targetX:pos?.x,targetY:pos?.y};
      }
      canvas.style.cursor='grabbing';scheduleDraw();
    });
    on(canvas,'pointermove',e=>{
      const p=localPoint(e);
      if(activePointers.has(e.pointerId))activePointers.set(e.pointerId,p);
      if(gesture&&activePointers.size===2){
        const [a,b]=[...activePointers.values()],next=Math.max(.07,Math.min(7,gesture.transform.scale*Math.hypot(a.x-b.x,a.y-b.y)/gesture.distance)),ratio=next/gesture.transform.scale;
        graph.transform={x:(a.x+b.x)/2-width/2-(gesture.middle.x-gesture.transform.x)*ratio,y:(a.y+b.y)/2-height/2-(gesture.middle.y-gesture.transform.y)*ratio,scale:next};
        labels.dirty=true;motion.home={x:graph.transform.x,y:graph.transform.y};scheduleDraw();return;
      }
      if(activePointers.size&&!pointer)return;
      if(pointer&&pointer.id!==e.pointerId)return;
      if(pointer){const dx=p.x-pointer.x,dy=p.y-pointer.y;pointer.moved ||= Math.hypot(p.x-pointer.originX,p.y-pointer.originY)>3;if(pointer.moved){if(pointer.node){pointer.targetX+=dx/graph.transform.scale;pointer.targetY+=dy/graph.transform.scale;wakePhysics();}else {motion.panTarget??={x:graph.transform.x,y:graph.transform.y};motion.panTarget.x+=dx*motion.panGain;motion.panTarget.y+=dy*motion.panGain;}}pointer.x=p.x;pointer.y=p.y;scheduleDraw();return;}
      if(e.pointerType==='touch')return;
      const n=nodeAt(p.x,p.y);graph.hover=n?.id||null;canvas.style.cursor=n?'pointer':'grab';const tooltip=$('#graph-tooltip');tooltip.hidden=!n;
      if(n){tooltip.textContent=`${displayName(n)} · ${entityCaption(n)}`;tooltip.style.left=Math.max(8,Math.min(p.x+12,width-240))+'px';tooltip.style.top=Math.max(80,Math.min(p.y+18,height-120))+'px';}
      scheduleDraw();
    });
    function releasePointer(e){
      activePointers.delete(e.pointerId);
      if(gesture){if(activePointers.size<2)gesture=null;pointer=null;motion.home={x:graph.transform.x,y:graph.transform.y};}
      else if(pointer?.id===e.pointerId){
        const dragged=pointer.moved&&pointer.node,panned=pointer.moved&&!pointer.node;
        if(e.type==='pointerup'&&!pointer.moved&&pointer.node)selectNode(pointer.node.id);
        pointer=null;if(dragged)wakePhysics();if(panned)returnPan();
      }
      if(canvas.hasPointerCapture(e.pointerId))canvas.releasePointerCapture(e.pointerId);
      canvas.style.cursor='grab';scheduleDraw();
    }
    on(canvas,'pointerup',releasePointer);
    on(canvas,'pointercancel',releasePointer);
    on(canvas,'lostpointercapture',releasePointer);
    on(document,'visibilitychange',()=>{
      if(document.hidden){if(pointer?.moved&&!pointer.node||motion.panReturn){graph.transform.x=motion.home.x;graph.transform.y=motion.home.y;}pointer=null;gesture=null;activePointers.clear();motion.panTarget=null;motion.panReturn=null;graph.hover=null;$('#graph-tooltip').hidden=true;physics.lastTime=0;motion.lastTime=0;if(frame)cancelAnimationFrame(frame);frame=0;}
      else scheduleDraw();
    });
    function syncMotionButton(){const button=$('#toggle-motion'),paused=motion.paused||reducedMotion.matches;button.disabled=reducedMotion.matches;button.setAttribute('aria-pressed',String(paused));button.title=reducedMotion.matches?'系统已启用减少动态效果':paused?'继续待机浮动':'暂停待机浮动';button.setAttribute('aria-label',button.title);button.innerHTML=icon(paused?'play':'pause')+`<span>${reducedMotion.matches?'静赏中':paused?'继续流动':'静赏'}</span>`;}
    on($('#toggle-motion'),'click',()=>{motion.paused=!motion.paused;syncMotionButton();scheduleDraw();});
    on(reducedMotion,'change',()=>{labels.dirty=true;motion.ambientTime=0;motion.renderedTime=0;if(reducedMotion.matches&&motion.panReturn)returnPan();syncMotionButton();updateMotionStatus();scheduleDraw();});
    on($('#toggle-detail'),'click',()=>setDetailOpen(workspace.dataset.detailCollapsed==='true'));
    on($('.skip-link'),'click',e=>{e.preventDefault();canvas.focus();});
    on($('#toggle-filters'),'click',()=>{const open=workspace.dataset.filtersOpen!=='true';workspace.dataset.filtersOpen=String(open);$('#toggle-filters').setAttribute('aria-expanded',String(open));});
    const guide=$('#viewer-guide');
    on($('#open-guide'),'click',()=>guide.showModal());
    on($('#close-guide'),'click',()=>guide.close());on($('#guide-done'),'click',()=>guide.close());
    on(guide,'click',e=>{const r=guide.getBoundingClientRect();if(e.target===guide&&(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom))guide.close();});
    on($('#toggle-fullscreen'),'click',async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await document.documentElement.requestFullscreen();}catch{$('#viewer-status').textContent='浏览器未能进入全屏，可按 F11 全屏观览。';}});
    $('#toggle-fullscreen').setAttribute('aria-label','全屏观览');
    on(document,'fullscreenchange',()=>{const full=!!document.fullscreenElement;$('#toggle-fullscreen').setAttribute('aria-pressed',String(full));$('#toggle-fullscreen').setAttribute('aria-label',full?'退出全屏':'全屏观览');$('#toggle-fullscreen span').textContent=full?'退出全屏':'全屏观览';});
    on(canvas,'pointerleave',()=>{graph.hover=null;$('#graph-tooltip').hidden=true;scheduleDraw();});
    on(canvas,'dblclick',e=>{const p=localPoint(e),n=nodeAt(p.x,p.y);if(n)focusAround(n.id);});
    on(canvas,'keydown',e=>{
      if(['+','=','-','Home','Enter','ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key))e.preventDefault();
      if(e.key==='+'||e.key==='=')zoom(1.25);if(e.key==='-')zoom(.8);if(e.key==='Home'){fit();scheduleDraw();}if(e.key==='Enter')focusAround(graph.selected);
      const moves={ArrowLeft:[30,0],ArrowRight:[-30,0],ArrowUp:[0,30],ArrowDown:[0,-30]};if(moves[e.key]){graph.transform.x+=moves[e.key][0];graph.transform.y+=moves[e.key][1];returnPan();}
    });
    const observer=new ResizeObserver(()=>{fit();scheduleDraw();});observer.observe(canvas.parentElement);
    setDetailOpen(false);syncMotionButton();resetDefault();
    return ()=>{destroyed=true;observer.disconnect();signalController.abort();if(frame)cancelAnimationFrame(frame);};
  }
  window.addEventListener('hashchange',render);
  if(location.hash!=='#/graph') history.replaceState(null,'','#/graph');
  render();
})();
