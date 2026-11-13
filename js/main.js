const icon = (name) => {
  const icons = {
    camera: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h3l2-3h6l2 3h3a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2Z"/><circle cx="12" cy="13" r="3.5"/></svg>',
    search: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.8" cy="10.8" r="6.8"/><path d="m16 16 4.5 4.5"/></svg>',
    workout: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 8v8m-3-6v4m18-4v4m-3-6v8M6 12h12"/></svg>',
    water: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3S5.5 10.2 5.5 14.5a6.5 6.5 0 0 0 13 0C18.5 10.2 12 3 12 3Z"/><path d="M9 15a3 3 0 0 0 3 3"/></svg>',
    upload: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 16V4m-5 5 5-5 5 5"/><path d="M4 15v4a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-4"/></svg>'
  };
  return icons[name] || '';
};

const state = { page: 'dashboard', calories: 1386, water: 1100, portion: '一碗（约 180g）', confirmed: false, chatMessages: [] };
const pageContent = document.querySelector('#pageContent');
const titleMap = { dashboard: '今日概览', food: '餐食记录', plans: '我的计划', coach: 'AI 健康助手', review: '每周复盘', profile: '个人档案' };

function renderDashboard() {
  return `<div class="app-content">
    <div class="welcome-row"><div><div class="eyebrow">星期三 · 5月21日</div><h1>早上好，林同学<span>。</span></h1><p>今天不用做到完美，照顾好自己就很好。</p></div><button class="welcome-action" data-action="assessment">${icon('workout')} 更新我的健康画像</button></div>
    <div class="dashboard-grid"><div class="left-stack">
      <section class="surface energy-card"><div class="section-heading"><h2>今天的饮食节奏</h2><span class="goal-tag">轻盈进阶计划</span></div><div class="energy-body"><div class="ring" aria-label="今日热量目标完成约60%"><div class="ring-center"><strong>62%</strong><span>今日进度</span></div></div><div class="energy-copy"><div class="kcal-label">已摄入热量</div><div class="kcal-number"><b>${state.calories.toLocaleString()}</b> <span>/ 2,250 kcal</span></div><div class="remain">还有 <strong>${(2250-state.calories).toLocaleString()} kcal</strong> 的弹性空间</div><div class="macro-list"><div class="macro-line"><span>蛋白质</span><div class="macro-track"><div class="macro-fill" style="width:58%"></div></div><b>72 / 125g</b></div><div class="macro-line"><span>碳水</span><div class="macro-track"><div class="macro-fill" style="width:51%"></div></div><b>118 / 230g</b></div><div class="macro-line"><span>脂肪</span><div class="macro-track"><div class="macro-fill" style="width:46%"></div></div><b>34 / 74g</b></div></div></div></div><div class="energy-foot"><span>目标是参考范围，不是考试分数。</span><button class="link-button" data-page="plans">查看营养目标 ↗</button></div></section>
      <section class="surface training-card"><div class="section-title"><h2>今天的身体时间</h2><button data-page="plans">查看本周安排 ↗</button></div><div class="training-content"><div class="training-icon">${icon('workout')}</div><div class="training-info"><strong>全身基础力量 · 轻松开始</strong><p>深蹲、臀桥、墙面俯卧撑 · 3 个动作</p></div><span class="training-time">约 25 分钟</span></div><div class="training-bottom"><span>强度：轻松 · 可在家完成</span><button class="primary-button" data-action="workout">开始训练</button></div></section>
      <section class="surface quick-card"><div class="section-title"><h2>记录今天的一点点</h2><button data-page="food">全部记录 ↗</button></div><div class="quick-actions"><button class="quick-action" data-action="upload"><span class="quick-icon">${icon('camera')}</span>拍照记一餐</button><button class="quick-action" data-action="search-food"><span class="quick-icon">${icon('search')}</span>搜索食物</button><button class="quick-action" data-action="weight"><span class="quick-icon">⌁</span>记一下体重</button></div></section>
    </div><div class="right-stack">
      <section class="surface pending-card"><div class="pending-top"><span class="pending-mark">✳</span><strong>有一条识别结果等你确认</strong><small>刚刚</small></div><p>午餐照片里可能有米饭和香煎鸡胸。份量由你来定，确认后才会计入今天。</p><button data-page="food">看看识别结果　↗</button></section>
      <section class="assistant-card"><div class="assistant-head"><span class="assistant-spark">✳</span><strong>你的健康搭子</strong><small>在线陪你</small></div><p>我看到你今天还有训练安排。午餐确认后，我可以一起帮你看看晚餐怎么搭配更舒服。</p><div class="suggestions"><button class="suggestion" data-prompt="晚餐怎么补足蛋白质？">晚餐怎么吃？</button><button class="suggestion" data-prompt="我只有二十分钟，今天训练怎么安排？">今天怎么练？</button></div><form class="assistant-input" data-form="assistant"><input aria-label="问健康搭子" placeholder="说说你现在在想什么…" /><button aria-label="发送问题">↗</button></form></section>
      <section class="surface weight-card"><div class="section-title"><h2>体重趋势</h2><button data-page="review">近 7 天 ↗</button></div><div class="weight-main"><strong>63.4</strong><span>kg</span><span class="weight-change">↓ 0.6 kg</span></div><svg class="weight-chart" viewBox="0 0 330 86" preserveAspectRatio="none" role="img" aria-label="体重近七天缓慢下降趋势"><defs><linearGradient id="areaFill" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#dce9dc" stop-opacity=".75"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient></defs><path class="axis" d="M0 18H330M0 47H330M0 76H330"/><path class="area" d="M8 62 C35 55 43 58 61 51 S91 48 112 52 S146 35 165 40 S201 48 219 34 S252 36 272 25 S304 28 322 17 V86H8Z"/><path class="line" d="M8 62 C35 55 43 58 61 51 S91 48 112 52 S146 35 165 40 S201 48 219 34 S252 36 272 25 S304 28 322 17"/><circle cx="322" cy="17" r="3.4"/></svg><div class="chart-labels"><span>周四</span><span>周六</span><span>周一</span><span>周三</span></div></section>
      <section class="surface hydration-card"><div class="section-title"><h2>喝水也算照顾自己</h2><span class="goal-tag">${state.water} / 2,000 ml</span></div><div class="hydration-row"><span class="water-icon">${icon('water')}</span><div class="water-detail"><strong>每一杯都算数</strong><small>今天已记录 4 杯</small></div><button class="water-add" data-action="water" aria-label="记录一杯水">+</button></div><div class="water-progress"><span style="width:${Math.min(100,state.water/20)}%"></span></div></section>
    </div></div>
  </div>`;
}

function renderFood() {
  return `<div class="app-content"><div class="page-heading"><div class="eyebrow">多模态餐食记录</div><h1>一张照片，轻松记下一餐。</h1><p>AI 先帮你看一眼；哪里不准，你来修正。确认之前不会计入营养统计。</p></div><div class="food-layout"><div><section class="surface meal-card"><div class="section-title"><h2>记录午餐</h2><span class="goal-tag">今天 · 12:18</span></div><div class="upload-zone" id="uploadZone"><div><div class="upload-symbol">${icon('upload')}</div><strong>把这顿饭交给我看看</strong><p>拍照或上传图片，再用文字告诉我份量和做法</p><div class="upload-buttons"><button class="subtle-button" data-action="choose-photo">${icon('camera')} 上传餐食照片</button><button class="subtle-button" data-action="voice">◖ 语音补充</button></div><input type="file" id="photoInput" accept="image/*" hidden /></div></div><textarea class="meal-note" id="mealNote" placeholder="例如：米饭只有半碗，鸡胸肉是煎的，少油…" aria-label="补充餐食信息"></textarea></section><section class="surface meal-timeline"><div class="section-title"><h2>今天已经记录</h2><span class="goal-tag">${state.confirmed?'3':'2'} 餐</span></div><div class="meal-row"><span class="meal-bullet">☼</span><div><strong>早餐 · 燕麦酸奶碗</strong><small>燕麦、希腊酸奶、蓝莓 · 08:12</small></div><b>386 kcal</b></div><div class="meal-row"><span class="meal-bullet">◌</span><div><strong>上午加餐 · 苹果</strong><small>中等大小 · 10:35</small></div><b>95 kcal</b></div>${state.confirmed?'<div class="meal-row"><span class="meal-bullet">◉</span><div><strong>午餐 · 鸡胸肉杂粮饭</strong><small>已由你确认 · 12:18</small></div><b>615 kcal</b></div>':''}</section></div><div class="right-stack"><section class="surface food-result"><div class="section-title"><h2>AI 的初步识别</h2><span class="confidence">可信度 86%</span></div><div class="meal-photo" aria-label="餐食图片预览"><div class="plate"><span class="food-piece"></span><span class="food-piece second"></span></div><span class="food-photo-label">演示餐食 · 可替换上传</span></div><div class="result-title"><strong>看起来像一份家常午餐</strong><span class="confidence">待确认</span></div><div class="food-ingredient"><span>鸡胸肉</span><span>约 120g</span></div><div class="food-ingredient"><span>米饭</span><span class="portion-control"><button data-action="portion-down" aria-label="减少米饭份量">−</button><span id="portionText">${state.portion}</span><button data-action="portion-up" aria-label="增加米饭份量">+</button></span></div><div class="food-ingredient"><span>时蔬 · 烹饪用油不确定</span><span>约 100g</span></div><div class="result-kcal"><span>估算能量</span><strong>约 520 kcal</strong></div><div class="range-note">合理范围 430–640 kcal · 烹饪用油会带来误差</div><div class="result-actions"><button class="primary-button" data-action="confirm-food">确认并记录</button><button class="subtle-button" data-action="edit-food">继续修正</button></div></section><section class="info-panel"><h3>这次估算怎么来的？</h3><div class="info-list"><div><span class="info-check">✓</span><span>图片识别到 3 类食物，份量来自视觉估计。</span></div><div><span class="info-check">~</span><span>油量无法仅凭照片确认，所以能量用区间呈现。</span></div><div><span class="info-check">i</span><span>你可以改食材或份量，确认后才会写入记录。</span></div></div></section></div></div></div>`;
}

function renderPlans() {
  const days = [['一','19'],['二','20'],['三','21'],['四','22'],['五','23'],['六','24'],['日','25']];
  return `<div class="app-content"><div class="page-heading"><div class="eyebrow">为真实生活留有余地</div><h1>你的计划，不必一成不变。</h1><p>根据目标、偏好与日常安排生成。每一个目标都有依据，也允许随时调整。</p></div><div class="plans-layout"><div><section class="surface meal-plan-card"><div class="section-title"><h2>本周 · 轻盈进阶计划</h2><button data-action="edit-plan">调整计划 ↗</button></div><div class="week-strip">${days.map((d,i)=>`<button class="day-chip ${i===2?'selected':''} ${i===6?'rest':''}" data-action="select-day"><small>周${d[0]}</small><strong>${d[1]}</strong><i></i></button>`).join('')}</div><div class="plan-hero"><div><strong>每日目标 2,250 kcal</strong><p>弹性范围 2,100–2,400 kcal · 依据当前目标估算</p></div><span class="goal-tag">温和减脂</span></div><div class="plan-meal"><span class="meal-time">08:00</span><div class="meal-detail"><strong>早餐 · 燕麦酸奶碗</strong><small>燕麦 40g、希腊酸奶、蓝莓 · 约 380 kcal</small></div><span class="meal-energy">P 24g</span></div><div class="plan-meal"><span class="meal-time">12:30</span><div class="meal-detail"><strong>午餐 · 鸡胸肉杂粮饭</strong><small>鸡胸肉、糙米饭、时蔬 · 约 520 kcal</small></div><span class="meal-energy">P 38g</span></div><div class="plan-meal"><span class="meal-time">16:00</span><div class="meal-detail"><strong>加餐 · 一杯无糖豆浆</strong><small>训练前补充 · 约 110 kcal</small></div><span class="meal-energy">P 9g</span></div><div class="plan-meal"><span class="meal-time">19:00</span><div class="meal-detail"><strong>晚餐 · 虾仁豆腐蔬菜碗</strong><small>可用鸡蛋或鸡胸肉替换 · 约 460 kcal</small></div><span class="meal-energy">P 36g</span></div></section><section class="surface workout-card"><div class="section-title"><h2>本周身体时间</h2><button data-action="edit-plan">调整训练频率 ↗</button></div><div class="workout-item"><span class="workout-check done">✓</span><div><strong>周一 · 灵活性与活动恢复</strong><small>髋部活动 + 轻松步行 · 20 分钟</small></div><span class="goal-tag">已完成</span></div><div class="workout-item"><span class="workout-check">○</span><div><strong>周三 · 全身基础力量</strong><small>深蹲、臀桥、墙面俯卧撑 · 25 分钟</small></div><span class="goal-tag">今天</span></div><div class="workout-item"><span class="workout-check">○</span><div><strong>周五 · 轻松心肺</strong><small>快走或骑行 · 25 分钟</small></div></div></section></div><div class="right-stack"><section class="surface adjust-card"><h3>这份计划为什么适合你？</h3><p>不是一张“标准答案”，而是从你提供的信息出发，留出能坚持的空间。</p><div class="change-row"><span class="change-symbol">◎</span><div><strong>你的目标</strong><small>温和减脂，同时建立力量基础</small></div></div><div class="change-row"><span class="change-symbol">◷</span><div><strong>你的时间</strong><small>工作日 25 分钟，居家训练</small></div></div><div class="change-row"><span class="change-symbol">⌂</span><div><strong>你的偏好</strong><small>少做饭，外食友好，避免花生</small></div></div><div class="change-row"><span class="change-symbol">~</span><div><strong>估算说明</strong><small>热量为参考范围，不是医疗建议</small></div></div></section><section class="info-panel"><h3>想局部改一改？</h3><p>告诉健康搭子“工作日不做饭”或“晚餐时间很晚”，我会优先调整相关餐次，不重做整份计划。</p><button class="link-button" data-page="coach">和健康搭子说说 ↗</button></section></div></div></div>`;
}

function renderReview() {
  const bars = [62,73,58,82,69,88,74];
  return `<div class="app-content"><div class="page-heading"><div class="eyebrow">看见过程，而不只是结果</div><h1>这一周，你已经做得不错。</h1><p>5月 12日—18日 · 记录有限时，我们先理解情况，不急着调整目标。</p></div><div class="review-layout"><div class="left-stack"><section class="surface review-score"><div class="section-title"><h2>本周执行节奏</h2><span class="goal-tag">记录完整度 71%</span></div><div class="score-main"><strong>4.2<span style="font-size:15px"> / 5</span></strong><span>比上周多了 1 次训练</span></div><div class="bar-chart" role="img" aria-label="一周饮食目标完成度柱状图">${bars.map((x,i)=>`<div class="bar-col"><span class="bar ${i===6?'current':''}" style="height:${x}%"></span><small>周${'一二三四五六日'[i]}</small></div>`).join('')}</div><div class="review-stat-grid"><div class="review-stat"><small>训练完成</small><strong>2 / 3 <span>次</span></strong></div><div class="review-stat"><small>平均记录能量</small><strong>1,940 <span>kcal</span></strong></div><div class="review-stat"><small>体重变化</small><strong>−0.6 <span>kg</span></strong></div><div class="review-stat"><small>主观状态</small><strong>平稳 <span>↗</span></strong></div></div></section><section class="assistant-card"><div class="assistant-head"><span class="assistant-spark">✳</span><strong>这一周的小发现</strong></div><p>你在有提前准备午餐的日子，蛋白质摄入更接近目标。周五没有训练记录，但不代表你没有努力；下周先保持现在的节奏就很好。</p></section></div><div class="right-stack"><section class="surface adjust-card"><h3>下周建议：先保持，不急着加码</h3><p>当前记录完整度一般，体重趋势平缓且持续向下。现有数据不足以支持调整每日目标。</p><div class="change-row"><span class="change-symbol">＝</span><div><strong>每日能量目标</strong><small>暂时保持 2,250 kcal</small></div><span>不变</span></div><div class="change-row"><span class="change-symbol">＋</span><div><strong>准备一个方便加餐</strong><small>无糖豆浆或希腊酸奶</small></div><span>建议</span></div><div class="change-row"><span class="change-symbol">↗</span><div><strong>训练安排</strong><small>继续每周 3 次，保持 20–25 分钟</small></div><span>不变</span></div><button class="primary-button" style="width:100%;margin-top:16px" data-action="accept-review">接受下周建议</button></section><section class="info-panel"><h3>为什么没有改目标？</h3><p>一周的体重会受水分、睡眠和日常节奏影响。先多记录几天，再一起看长期趋势，更不容易被短期波动带偏。</p></section></div></div></div>`;
}

function renderCoach() {
  return `<div class="app-content"><div class="page-heading"><div class="eyebrow">不确定的时候，随时聊聊</div><h1>你好，我在听。</h1><p>我会结合你的计划、近期记录和偏好给建议；不确定的地方，也会说清楚。</p></div><div class="coach-layout"><section class="surface chat-panel"><div class="chat-head"><span class="coach-avatar">✳</span><div><strong>你的健康搭子</strong><small>基于个人计划提供日常建议</small></div><span class="nav-live"></span></div><div class="chat-messages" id="chatMessages"><div class="message bot">今天午餐还在等你确认。确认以后，我可以结合你的训练安排，一起看看晚餐怎么搭配更合适。<cite>依据：今日饮食目标 + 周三训练安排</cite></div>${state.chatMessages.map(m=>`<div class="message user">${escapeHtml(m)}</div><div class="message bot">从你当前的温和减脂目标来看，晚餐可以优先安排一份手掌大小的蛋白质（例如鱼、鸡蛋或豆腐），搭配蔬菜和适量主食。今天午餐的具体营养还未确认，所以这里只能给方向性建议；确认后我可以再帮你细化。<cite>依据：你的目标与偏好 · 估算存在不确定性</cite></div>`).join('')}</div><div class="chat-suggestions"><button class="suggestion" data-prompt="今天晚餐怎么吃比较合适？">今天晚餐怎么吃？</button><button class="suggestion" data-prompt="我只有二十分钟，今天训练怎么安排？">我只有 20 分钟怎么练？</button><button class="suggestion" data-prompt="帮我把这周菜谱改得更便宜一些。">让这周吃得更省一点</button></div><form class="chat-input" data-form="chat"><input id="chatInput" aria-label="输入你的问题" placeholder="问问你的健康搭子…" /><button aria-label="发送问题">↗</button></form></section><aside class="chat-aside"><section class="surface context-card"><h3>这次建议会参考</h3><div class="context-item"><span class="context-dot"></span><div>温和减脂目标<small>健康画像 · 5月 18日更新</small></div></div><div class="context-item"><span class="context-dot"></span><div>今日训练计划<small>全身基础力量 · 25 分钟</small></div></div><div class="context-item"><span class="context-dot" style="background:#c8b68c"></span><div>午餐待确认<small>未确认前，不计入营养统计</small></div></div></section><section class="info-panel"><h3>小小的安全提醒</h3><p>智养 AI 帮助日常健康管理，不提供疾病诊断、治疗或医疗营养处方。如有特殊健康情况，请咨询专业医护人员。</p></section></aside></div></div>`;
}

function renderProfile() {
  return `<div class="app-content"><div class="page-heading"><div class="eyebrow">你的数据，由你掌握</div><h1>个人健康画像</h1><p>修改会影响后续建议。只填写你愿意分享的信息，随时可以更新或清除。</p></div><section class="surface meal-card"><div class="section-title"><h2>基础信息与生活偏好</h2><button class="link-button" data-action="assessment">编辑画像 ↗</button></div><div class="profile-grid" style="margin-top:17px"><div class="profile-field"><small>当前目标</small><strong>温和减脂 · 建立力量</strong></div><div class="profile-field"><small>每周训练</small><strong>3 次 · 每次约 25 分钟</strong></div><div class="profile-field"><small>训练环境</small><strong>居家 · 无器械</strong></div><div class="profile-field"><small>饮食偏好</small><strong>外食友好 · 少做饭</strong></div><div class="profile-field"><small>饮食禁忌</small><strong>避免花生</strong></div><div class="profile-field"><small>计划强度</small><strong>温和、可持续</strong></div></div></section><section class="surface meal-card" style="margin-top:14px"><div class="section-title"><h2>隐私与数据</h2></div><div class="info-list" style="margin-top:13px"><div><span class="info-check">✓</span><span>你确认后的餐食和训练记录才会进入营养统计。</span></div><div><span class="info-check">✓</span><span>餐食识别为估算结果，支持随时修改或删除。</span></div><div><span class="info-check">✓</span><span>演示原型数据保存在当前页面状态中，刷新后重置。</span></div></div></section></div>`;
}

function render() {
  const renderers = { dashboard: renderDashboard, food: renderFood, plans: renderPlans, review: renderReview, coach: renderCoach, profile: renderProfile };
  pageContent.innerHTML = (renderers[state.page] || renderDashboard)();
  document.querySelector('#breadcrumbTitle').textContent = titleMap[state.page] || '今日概览';
  document.querySelectorAll('[data-page]').forEach(button => button.classList.toggle('active', button.dataset.page === state.page));
}

function toast(message) {
  const el = document.querySelector('#toast');
  el.textContent = message;
  el.classList.add('show');
  window.clearTimeout(toast.timer);
  toast.timer = window.setTimeout(() => el.classList.remove('show'), 2600);
}

function go(page) {
  state.page = page;
  render();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function escapeHtml(value) {
  return value.replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
}

function sendMessage(value) {
  const message = value.trim();
  if (!message) return;
  state.chatMessages.push(message);
  state.page = 'coach';
  render();
}

function showAssessment() {
  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop';
  backdrop.innerHTML = `<section class="modal" role="dialog" aria-modal="true" aria-labelledby="assessmentTitle"><h2 id="assessmentTitle">先从你的目标开始</h2><p>告诉我你最想关注什么。我们会根据你愿意分享的信息慢慢完善计划，不需要一次填完。</p><div class="assessment-steps"><span class="step done"></span><span class="step"></span><span class="step"></span></div><div class="assessment-options"><button class="assessment-option selected">温和减脂</button><button class="assessment-option">建立力量</button><button class="assessment-option">改善体能</button><button class="assessment-option">维持状态</button></div><div class="modal-actions"><button class="subtle-button" data-close>稍后再说</button><button class="primary-button" data-save>保存并继续</button></div></section>`;
  document.body.appendChild(backdrop);
  backdrop.addEventListener('click', event => {
    if (event.target === backdrop || event.target.closest('[data-close]')) backdrop.remove();
    if (event.target.matches('.assessment-option')) {
      backdrop.querySelectorAll('.assessment-option').forEach(option => option.classList.remove('selected'));
      event.target.classList.add('selected');
    }
    if (event.target.closest('[data-save]')) { backdrop.remove(); toast('健康画像已更新，计划会以此为参考。'); }
  });
}

document.addEventListener('click', event => {
  const pageButton = event.target.closest('[data-page]');
  if (pageButton) { go(pageButton.dataset.page); return; }
  const prompt = event.target.closest('[data-prompt]');
  if (prompt) { sendMessage(prompt.dataset.prompt); return; }
  const actionButton = event.target.closest('[data-action]');
  if (!actionButton) return;
  const action = actionButton.dataset.action;
  if (action === 'assessment') showAssessment();
  if (action === 'coach') go('coach');
  if (action === 'upload') go('food');
  if (action === 'search-food') { go('food'); setTimeout(() => document.querySelector('#mealNote')?.focus(), 50); }
  if (action === 'weight') { const weight = window.prompt('记录今天的体重（kg）', '63.4'); if (weight) toast(`已记录 ${weight} kg，趋势会随着数据逐步形成。`); }
  if (action === 'water') { state.water = Math.min(2000, state.water + 250); render(); toast('已记下一杯水，慢慢来就好。'); }
  if (action === 'workout') { actionButton.textContent = '训练已开始'; actionButton.disabled = true; toast('训练计时开始。记得按自己的状态调整强度。'); }
  if (action === 'choose-photo') document.querySelector('#photoInput')?.click();
  if (action === 'voice') toast('语音补充原型：可先在文字框描述份量和做法。');
  if (action === 'portion-down' || action === 'portion-up') { state.portion = action === 'portion-down' ? '半碗（约 90g）' : '一碗半（约 270g）'; document.querySelector('#portionText').textContent = state.portion; toast(`已调整为${state.portion}，估算结果会随之变化。`); }
  if (action === 'confirm-food') { state.confirmed = true; state.calories = 2001; render(); toast('午餐已确认并计入今天营养统计。'); }
  if (action === 'edit-food') { const note = document.querySelector('#mealNote'); note?.focus(); toast('告诉我哪里需要修正，我会优先调整这顿饭。'); }
  if (action === 'edit-plan') toast('计划调整已打开：你可以和健康搭子说明想改的部分。');
  if (action === 'select-day') { document.querySelectorAll('.day-chip').forEach(day => day.classList.remove('selected')); actionButton.classList.add('selected'); }
  if (action === 'accept-review') { actionButton.textContent = '已接受，保持当前节奏'; actionButton.disabled = true; toast('下周计划已确认。我们继续观察，不急着加码。'); }
});

pageContent.addEventListener('submit', event => {
  const form = event.target.closest('[data-form]');
  if (!form) return;
  event.preventDefault();
  const input = form.querySelector('input');
  if (input.value.trim()) sendMessage(input.value);
});

pageContent.addEventListener('change', event => {
  if (event.target.id !== 'photoInput' || !event.target.files?.[0]) return;
  const file = event.target.files[0];
  const reader = new FileReader();
  reader.onload = () => {
    const photo = document.querySelector('.meal-photo');
    if (photo) {
      photo.style.background = `center / cover no-repeat url("${reader.result}")`;
      photo.querySelector('.plate')?.remove();
      photo.querySelector('.food-photo-label').textContent = file.name;
    }
    toast('照片已载入。识别内容仍需你核对后确认。');
  };
  reader.readAsDataURL(file);
});

pageContent.addEventListener('dragover', event => { if (event.target.closest('#uploadZone')) { event.preventDefault(); event.target.closest('#uploadZone').classList.add('dragging'); } });
pageContent.addEventListener('dragleave', event => event.target.closest('#uploadZone')?.classList.remove('dragging'));
pageContent.addEventListener('drop', event => {
  const zone = event.target.closest('#uploadZone');
  if (!zone) return;
  event.preventDefault(); zone.classList.remove('dragging');
  const file = event.dataTransfer.files[0];
  if (file?.type.startsWith('image/')) { const input = document.querySelector('#photoInput'); const transfer = new DataTransfer(); transfer.items.add(file); input.files = transfer.files; input.dispatchEvent(new Event('change', { bubbles: true })); }
});

render();
