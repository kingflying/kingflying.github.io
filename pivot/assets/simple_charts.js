
// 简易离线K线渲染器（Canvas），支持OHLC蜡烛、上下影线、标注(H/L/T1)
(function(){
  function drawTriangle(ctx, x, y, size, direction, color){
    ctx.fillStyle = color;
    ctx.beginPath();
    if(direction==='down'){ ctx.moveTo(x, y); ctx.lineTo(x-size, y-size); ctx.lineTo(x+size, y-size); }
    else { ctx.moveTo(x, y); ctx.lineTo(x-size, y+size); ctx.lineTo(x+size, y+size); }
    ctx.closePath(); ctx.fill();
  }
  function drawCircle(ctx, x, y, r, color){ ctx.strokeStyle=color; ctx.lineWidth=2; ctx.beginPath(); ctx.arc(x,y,r,0,Math.PI*2); ctx.stroke(); }
  function clamp(v,a,b){ return Math.max(a, Math.min(b, v)); }

  function fallbackToImages(){
    document.querySelectorAll('[id^=chart-]').forEach(function(el){
      var img = el.getAttribute('data-img');
      if(img){ el.innerHTML = '<img src="'+img+'" style="max-width:100%;max-height:450px;height:auto;border:1px solid #e9ecef;border-radius:12px;box-shadow:0 8px 25px rgba(0,0,0,0.12);" />'; }
    });
  }

  function renderContainer(container, payload){
    var width = container.clientWidth || 800;
    var height = container.clientHeight || 450;
    container.innerHTML='';
    var canvas = document.createElement('canvas');
    canvas.width = width; canvas.height = height; canvas.style.width='100%'; canvas.style.height='100%';
    container.appendChild(canvas);
    var ctx = canvas.getContext('2d');
    var ohlc = (payload && payload.ohlc) || [];
    var markers = (payload && payload.markers) || [];
    if(!ohlc.length){ container.innerHTML = '<div style="color:#7f8c8d">无数据</div>'; return; }

    // 价格范围
    var minP = Infinity, maxP = -Infinity;
    for(var i=0;i<ohlc.length;i++){ var d=ohlc[i]; if(d.low<minP) minP=d.low; if(d.high>maxP) maxP=d.high; }
    if(!isFinite(minP) || !isFinite(maxP) || minP>=maxP){ minP=0; maxP=1; }
    var marginY = (maxP - minP) * 0.05;
    minP = Math.max(0, minP - marginY); // 不低于0
    maxP = maxP + marginY;

    // 坐标系
    var padL=60, padR=20, padT=20, padB=30;
    var plotW = Math.max(10, width - padL - padR);
    var plotH = Math.max(10, height - padT - padB);
    ctx.fillStyle='#f8f9fa'; ctx.fillRect(padL, padT, plotW, plotH);
    ctx.strokeStyle='#dee2e6'; ctx.strokeRect(padL, padT, plotW, plotH);

    // 网格+价格轴
    ctx.strokeStyle='rgba(60,60,60,0.06)'; ctx.lineWidth=1;
    for(var gi=1; gi<5; gi++){ var y = padT + plotH * gi/5; ctx.beginPath(); ctx.moveTo(padL,y); ctx.lineTo(padL+plotW,y); ctx.stroke(); }
    ctx.fillStyle='#2c3e50'; ctx.font='11px -apple-system,Segoe UI,Roboto,Arial';
    for(var pi=0; pi<=8; pi++){
      var ratio = pi/8; var price = minP + (maxP - minP) * (1 - ratio);
      var ylbl = padT + plotH * ratio; var text = price>=100?price.toFixed(1):price>=10?price.toFixed(2):price.toFixed(3);
      ctx.fillText(text, padL-10-ctx.measureText(text).width, ylbl+4);
    }

    // X轴映射
    var n = ohlc.length; var candleW = Math.max(3, Math.min(12, plotW / n * 0.7));
    function xAt(i){ return padL + (plotW * (n===1?0.5:(i/(n-1)))); }
    function yAt(p){ return padT + ((maxP - p)/(maxP - minP)) * plotH; }

    // 蜡烛
    for(var ci=0; ci<n; ci++){
      var d2 = ohlc[ci]; var x = xAt(ci); var yH=yAt(d2.high), yL=yAt(d2.low), yO=yAt(d2.open), yC=yAt(d2.close);
      var isUp = d2.close>=d2.open; var outline = isUp?'#cc0000':'#008833'; var fill = isUp?'#ff3333':'#ffffff';
      // 影线
      ctx.strokeStyle=outline; ctx.lineWidth=2; ctx.beginPath(); ctx.moveTo(x, yH); ctx.lineTo(x, yL); ctx.stroke();
      // 实体
      var left = Math.round(x - candleW/2), right = Math.round(x + candleW/2);
      var top = Math.round(Math.min(yO,yC)), bottom = Math.round(Math.max(yO,yC));
      ctx.fillStyle=fill; ctx.strokeStyle=outline; ctx.lineWidth=isUp?1:2;
      if(Math.abs(top-bottom)<1){ ctx.beginPath(); ctx.moveTo(left, top); ctx.lineTo(right, top); ctx.stroke(); }
      else { ctx.fillRect(left, top, right-left, bottom-top); ctx.strokeRect(left, top, right-left, bottom-top); }
    }

    // 标注
    for(var mi=0; mi<markers.length; mi++){
      var m = markers[mi];
      var idx = -1; for(var fi=0; fi<ohlc.length; fi++){ if(ohlc[fi].time===m.time){ idx=fi; break; } }
      if(idx<0) continue;
      var x3 = xAt(idx);
      var d3 = ohlc[idx];
      var baseY = (m.position==='aboveBar')? yAt(d3.high) - 6 : yAt(d3.low) + 6;
      if(m.shape==='circle'){ drawCircle(ctx, x3, baseY, 8, m.color||'#f39c12'); ctx.fillStyle=m.color||'#f39c12'; ctx.fillText(m.text||'', x3+10, baseY-8); }
      else if(m.position==='aboveBar'){ drawTriangle(ctx, x3, baseY, 6, 'down', m.color||'#ff0000'); }
      else { drawTriangle(ctx, x3, baseY, 6, 'up', m.color||'#0000ff'); }
    }
  }

  function loadScript(src){ return new Promise(function(resolve,reject){ var s=document.createElement('script'); s.src=src; s.onload=resolve; s.onerror=reject; document.head.appendChild(s); }); }

  function renderChartsFromJson(url){
    fetch(url, {cache:'no-store'}).then(function(r){ return r.json(); }).then(function(payloads){
      Object.entries(payloads||{}).forEach(function(entry){ var code=entry[0], payload=entry[1]; var id = 'chart-' + code.replace(/\./g,'_'); var el = document.getElementById(id); if(!el){ return; } try{ renderContainer(el, payload); } catch(e){ var img = el.getAttribute('data-img'); if(img){ el.innerHTML = '<img src="'+img+'" style="max-width:100%;max-height:450px;height:auto;border:1px solid #e9ecef;border-radius:12px;box-shadow:0 8px 25px rgba(0,0,0,0.12);" />'; } } });
    }).catch(function(){
      // fetch失败，尝试JS后备
      var jsUrl = url.replace(/\.json$/i, '.js');
      loadScript(jsUrl).then(function(){
        var payloads = window.CHARTS_DATA || {};
        Object.entries(payloads||{}).forEach(function(entry){ var code=entry[0], payload=entry[1]; var id = 'chart-' + code.replace(/\./g,'_'); var el = document.getElementById(id); if(!el){ return; } try{ renderContainer(el, payload); } catch(e){ var img = el.getAttribute('data-img'); if(img){ el.innerHTML = '<img src="'+img+'" style="max-width:100%;max-height:450px;height:auto;border:1px solid #e9ecef;border-radius:12px;box-shadow:0 8px 25px rgba(0,0,0,0.12);" />'; } } });
      }).catch(function(){ fallbackToImages(); });
    });
  }

  window.renderChartsFromJson = renderChartsFromJson;
})();
