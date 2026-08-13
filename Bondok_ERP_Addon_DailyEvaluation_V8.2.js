/* ═══════════════════════════════════════════════════════════════════════
 * Bondok ERP Pro — ملحق ميزة "تقييم الموظفين" اليومي (الإصدار V8.2)
 * ───────────────────────────────────────────────────────────────────
 * هذا الملف يحتوي كود ميزة تقييم الموظفين اليومي فقط، مصمم للدمج في
 * ملف النظام الأساسي (Bondok_ERP_Pro_V8.0_Final.html أو أي نسخة أحدث).
 *
 * طريقة الدمج اليدوي:
 *   افتح هذا الملف في أي محرر نصوص، ثم انقل كل "جزء" (أجزاء 1-6)
 *   إلى الموضع المكتوب أعلى كل جزء داخل ملف النظام.
 *   الدالة checkDailyEvalAddon() في نهاية الملف تتحقق من اكتمال الدمج.
 *
 * المتطلبات في ملف النظام:
 *   go, kpiHTML, bindKPI, saveState, toast, openModal, closeModal,
 *   empById, confirm2, logAudit, dlCSV, isActive, kpiGrade, curView/kpiTab
 * ═══════════════════════════════════════════════════════════════════════ */
// ═══════════════════════════════════════════════════════════════════════
// الجزء 1 من 6: التعريفات
// الموضع: منطقة التعريفات العامة (بجوار const KPI_HISTORY أو EVAL_360)
// الاستبدال: ابحث عن سطر "const KPI_HISTORY = [];" والصق بعدها مباشرة:
// ═══════════════════════════════════════════════════════════════════════
const DAILY_DIMS = [
  ['haircut','حلاقة'],['beard','الذقن'],['managers','التعامل مع المديرين'],['colleagues','التعامل مع الزملاء'],
  ['customers','التعامل مع العملاء'],['punctuality','الإلتزام بالمواعيد'],['orders','إطاعة الاوامر'],
  ['performance','الآداء اليومى'],['appearance','النظافة والمظهر الخارجى'],['uniform','إرتداء يونيفورم كامل']
];
let DAILY_EVALS = []; // {id, period:'YYYY-MM', empId, rows:{day1:{dim:val,...}, ...}, by:'اسم المقيّم'}
let dailyEvalId = 1;
let dailyFilter = {period: new Date().toISOString().slice(0,7), branch:'all', emp:''}; // الفترة والفرع والموظف المعروض حاليًا
function dailyEvalOf(period, empId){ return DAILY_EVALS.find(x=>x.period===period && x.empId===empId); }
function dailyTotal(row){
  let sum=0;
  DAILY_DIMS.forEach(d=>{ const v=+row[d[0]]; if(v) { sum+=v; } });
  return sum;
}
function dailyPeriodTotals(ev){
  let total=0; Object.values(ev.rows||{}).forEach(r=>total+=dailyTotal(r));
  return total;
}
function dailyAvgScore(ev){
  const days = Object.keys(ev.rows||{}).filter(d=>ev.rows[d] && dailyTotal(ev.rows[d])>0);
  if(!days.length) return 0;
  const avg = days.reduce((s,d)=>s+dailyTotal(ev.rows[d]),0)/days.length;
  return Math.round(avg);
}
// ═══════════════════════════════════════════════════════════════════════
// الجزء 2 من 6: الحفظ والتحميل (أربع مواضع صغيرة)
// ───────────────────────────────────────────────────────────────────
// (أ) في دالة collectState (المصفوفة التي تحتوي KPI_SCORES, KPI_HISTORY, ...):
//     أضف DAILY_EVALS للمصفوفة:
//     قبل: KPI_SCORES, KPI_HISTORY, VISITS, CHECKLISTS, ...
//     بعد: KPI_SCORES, KPI_HISTORY, VISITS, CHECKLISTS, ..., DAILY_EVALS,
// ═══════════════════════════════════════════════════════════════════════
// السطر الأصلي بعد التعديل:
//    DB, BRANCHES, ARCHIVE, LEAVES, ATT_LOG, ATT_REQUESTS, BIO_IMPORTS, LEAVE_BALANCE,
//    EXCUSES, COMPLAINTS, PURCHASES, COURSES, TRAININGS, LOGIN_LOG,
//    EMP_CREDENTIALS, PERMISSIONS, ADVANCES, PENALTIES, PAYROLL_RUNS,
//    KPI_SCORES, KPI_HISTORY, VISITS, CHECKLISTS, MAINTENANCE, CUSTODY, DOCUMENTS, TASKS, WORKFLOWS, QUALITY_ACTIONS, ASSETS, OIL_FILTER_LOG,
//    USERS, attState, AUDIT_LOG, NOTIFICATIONS, CHAT_MESSAGES, SHIFTS, REPORT_SCHEDULES, WEEK_SHIFT_ASSIGN,
//    COMPANY_INFO, PENALTY_TYPES, REWARD_TYPES, HOLIDAYS, EVAL_360, DAILY_EVALS, DEPARTMENTS, THEME_COLORS, SCREEN_DEPARTMENTS, ALL_NAV,
// ───────────────────────────────────────────────────────────────────
// (ب) في دالة applyState (المسؤول عن استعادة المتغيرات):
//     أضف هذا السطر بعد:  EVAL_360 = s.EVAL_360 || EVAL_360;
//   >>> DAILY_EVALS = s.DAILY_EVALS || DAILY_EVALS;
// ───────────────────────────────────────────────────────────────────
// (ج) في كائن counters داخل loadState:
//     أضف dailyEvalId في نهاية السطر:
//     before: settingsTypeId, holidayId, eval360Id
//     after:  settingsTypeId, holidayId, eval360Id, dailyEvalId
//   >>> settingsTypeId, holidayId, eval360Id, dailyEvalId
// ───────────────────────────────────────────────────────────────────
// (د) في دالة applyRestoredState:
//     أضف في نهاية السطر:
//     settingsTypeId=c.settingsTypeId??settingsTypeId; holidayId=c.holidayId??holidayId; eval360Id=c.eval360Id??eval360Id; dailyEvalId=c.dailyEvalId??dailyEvalId;
// ═══════════════════════════════════════════════════════════════════════
// ═══════════════════════════════════════════════════════════════════════
// الجزء 3 من 6: تاب "تقييم الموظفين" في صفحة تقييم الأداء KPI
// الموضع: داخل دالة kpiHTML()
// ───────────────────────────────────────────────────────────────────
// (أ) أضف زر التاب الجديد بعد زر "تقييم 360" وقبل سطر الإغلاق '</div>':
//   >>>     '<button class="tab '+(kpiTab==='daily'?'active':'')+'" onclick="kpiTab=\'daily\';go(\'kpi\')"><i class="fas fa-clipboard-check" style="font-size:11px"></i> تقييم الموظفين</button>'+
// ───────────────────────────────────────────────────────────────────
// (ب) أضف شرط العرض بعد سطر:  if(kpiTab==='360') return tabs + eval360HTML();
//   >>> if(kpiTab==='daily') return tabs + dailyEvalHTML();
// ═══════════════════════════════════════════════════════════════════════
// ═══════════════════════════════════════════════════════════════════════
// الجزء 4 من 6: ربط التبويب في bindKPI()
// الموضع: أول دالة bindKPI() — أضف السطر التالي كأول سطر داخلها:
//   >>> if(kpiTab==='daily'){ bindDailyEval(); return; }
// ═══════════════════════════════════════════════════════════════════════
// ═══════════════════════════════════════════════════════════════════════
// الجزء 5 من 6: الدوال الكاملة
// الموضع: في نهاية وحدة KPI — قبل سطر:
//   // PHASE 2 MODULES — OPERATIONS / MAINTENANCE / CUSTODY / DOCUMENTS / MANAGERS
//   الصق الكتلة التالية كاملة:
// ═══════════════════════════════════════════════════════════════════════
function seedDailyEvalData(){
  if(DAILY_EVALS.length===0 && DB.length>0){
    const e = DB[0];
    const ev = { id: dailyEvalId++, period:'2026-07', empId:e.id, by:'مدير الفرع', rows:{} };
    for(let d=1; d<=30; d++){
      ev.rows[d] = {};
      DAILY_DIMS.forEach(dim => { ev.rows[d][dim[0]] = Math.min(10, Math.max(0, 10 - ((d + dim[0].length) % 3))); });
    }
    DAILY_EVALS.push(ev);
  }
}
function dailyEvalHTML(){
  seedV4Data(); seedDailyEvalData();
  const cur = new Date().toISOString().slice(0,7);
  if(!dailyFilter.period) dailyFilter.period = cur;
  const evs = DAILY_EVALS.filter(x=>x.period===dailyFilter.period);
  const periods = Array.from(new Set(DAILY_EVALS.map(x=>x.period))).sort().reverse();
  const periodOpts = (periods.length?periods:[cur]).map(p=>'<option value="'+p+'"'+(dailyFilter.period===p?' selected':'')+'>'+p+'</option>').join('');
  const branchOpts = ['<option value="all">كل الفروع</option>'].concat(BRANCHES.map(b=>'<option value="'+b+'"'+(dailyFilter.branch===b?' selected':'')+'>'+b+'</option>')).join('');
  const emps = DB.filter(isActive).filter(e=>dailyFilter.branch==='all'||e.branch===dailyFilter.branch);
  const empOpts = ['<option value="">كل الموظفين</option>'].concat(emps.map(e=>'<option value="'+e.id+'"'+(dailyFilter.emp==e.id?' selected':'')+'>'+e.name+' — '+e.job_title+'</option>')).join('');
  const selEv = evs.filter(x=>dailyFilter.emp==''||x.empId==dailyFilter.emp);
  // شريط الملخص
  const totalScore = selEv.reduce((s,x)=>s+dailyPeriodTotals(x),0);
  const avgPct = selEv.length ? Math.round(selEv.reduce((s,x)=>s+dailyAvgScore(x),0)/selEv.length) : 0;
  const filledDays = selEv.reduce((s,x)=>s+Object.keys(x.rows||{}).length,0);
  const head =
    '<div class="strip">'+
      '<div class="item"><div class="lb">الفترة المحددة</div><div class="vl">'+(dailyFilter.period||'-')+'</div></div>'+
      '<div class="item"><div class="lb">استمارات التقييم</div><div class="vl" style="color:var(--blue)">'+selEv.length+'</div></div>'+
      '<div class="item"><div class="lb">أيام مقيّمة</div><div class="vl" style="color:var(--green)">'+filledDays+'</div></div>'+
      '<div class="item"><div class="lb">متوسط الأداء</div><div class="vl" style="color:'+kpiGrade(avgPct).c+'">'+avgPct+'% — '+kpiGrade(avgPct).t+'</div></div>'+
    '</div>'+
    '<div class="card" style="padding:14px;margin-bottom:14px;display:flex;gap:10px;flex-wrap:wrap;align-items:center">'+
      '<div><label style="font-size:11px;color:var(--text2);display:block;margin-bottom:4px">الشهر</label>'+
        '<select id="dPeriod" style="background:var(--surf2);border:1px solid var(--bord);color:var(--text);border-radius:8px;padding:8px 11px;font-family:inherit">'+periodOpts+'</select></div>'+
      '<div><label style="font-size:11px;color:var(--text2);display:block;margin-bottom:4px">الفرع</label>'+
        '<select id="dBranch" style="background:var(--surf2);border:1px solid var(--bord);color:var(--text);border-radius:8px;padding:8px 11px;font-family:inherit">'+branchOpts+'</select></div>'+
      '<div><label style="font-size:11px;color:var(--text2);display:block;margin-bottom:4px">الموظف</label>'+
        '<select id="dEmp" style="background:var(--surf2);border:1px solid var(--bord);color:var(--text);border-radius:8px;padding:8px 11px;font-family:inherit;min-width:200px">'+empOpts+'</select></div>'+
      '<div style="flex:1"></div>'+
      '<button class="btn btn-pr" id="dNewEval"><i class="fas fa-plus"></i> إنشاء استمارة تقييم</button>'+
      '<button class="btn btn-grn" id="dExport"><i class="fas fa-file-excel"></i> تصدير</button>'+
    '</div>';
  if(selEv.length===0){
    return head + '<div class="empty"><i class="fas fa-clipboard-check"></i><p>لا توجد استمارات تقييم لهذه الفترة — اضغط "إنشاء استمارة تقييم" لبدء التقييم</p></div>';
  }
  return head + selEv.map(ev=>dailyEvalSheetHTML(ev)).join('');
}
function dailyEvalSheetHTML(ev){
  const e = empById(ev.empId); if(!e) return '';
  const total = dailyPeriodTotals(ev);
  const avg = dailyAvgScore(ev);
  const days = Object.keys(ev.rows).map(Number).sort((a,b)=>a-b);
  // رأس الاستمارة على نمط ملف الوورد: "تقييم الموظف – الاسم – في شهر الشهر"
  let html = '<div class="card card0" style="margin-bottom:14px">'+
    '<div class="mh"><div style="display:flex;align-items:center;gap:10px;flex:1;min-width:0">'+
      avEl(e.name,36)+
      '<div style="min-width:0"><div style="font-weight:800;font-size:13.5px;font-family:Cairo">تقييم الموظف – '+escapeHtml(e.name)+'</div>'+
      '<div style="font-size:11px;color:var(--text2)">'+e.job_title+' · '+bpHtml(e.branch)+' · تقييم '+ev.by+' في شهر '+ev.period+'</div></div>'+
    '</div><div style="display:flex;gap:6px">'+
      '<button class="btn btn-sm btn-view dEdit" data-ev="'+ev.id+'"><i class="fas fa-edit"></i> تعديل التقييم</button>'+
      '<button class="btn btn-sm btn-print dPrint" data-ev="'+ev.id+'"><i class="fas fa-print"></i> طباعة</button>'+
      '<button class="btn btn-sm btn-del dDel" data-ev="'+ev.id+'"><i class="fas fa-trash"></i></button>'+
    '</div></div>'+
    '<div style="padding:10px 15px 0;display:flex;gap:14px;flex-wrap:wrap;font-size:12px">'+
      '<div><span style="color:var(--text2)">إجمالي درجات التقييم: </span><span style="font-family:Cairo;font-weight:800;font-size:16px;color:var(--gold)">'+total+' / '+(days.length*100)+'</span></div>'+
      '<div><span style="color:var(--text2)">متوسط الأداء: </span><span style="font-family:Cairo;font-weight:800;font-size:16px;color:'+kpiGrade(avg).c+'">'+avg+'%</span></div>'+
      '<div><span style="color:var(--text2)">الأيام المقيّمة: </span><span style="font-weight:700;color:var(--text)">'+days.length+'</span></div>'+
    '</div>';
  // جدول الأيام 1-30
  html += '<div class="tw tc" style="max-height:560px"><table><thead><tr><th style="width:60px">م / اليوم</th>';
  DAILY_DIMS.forEach(d=>{ html += '<th>'+d[1]+'</th>'; });
  html += '<th style="width:80px">إجمالي اليوم</th></tr></thead><tbody>';
  for(let d=1; d<=30; d++){
    const row = ev.rows[d] || null;
    const t = dailyTotal(row);
    const tc = t>=90?'var(--green)':t>=70?'var(--blue)':t>0?'var(--gold)':'var(--text3)';
    html += '<tr'+(row?' style="background:rgba(20,22,35,.25)"':'')+'><td class="tdn"><span class="chip">'+d+'</span></td>';
    DAILY_DIMS.forEach(dim=>{
      const v = row ? (+row[dim[0]]||0) : 0;
      const c = v>=9?'var(--green)':v>=7?'var(--blue)':v>0?'var(--gold)':'var(--text3)';
      html += '<td style="color:'+c+';font-weight:'+(v?'700':'400')+'">'+(v||'—')+'</td>';
    });
    html += '<td style="font-family:Cairo;font-weight:800;color:'+tc+'">'+(row?t:'—')+'</td></tr>';
    if(row){
      const notes = DAILY_DIMS.map(dim=>(row[dim[0]+'_note']||'')).filter(n=>n);
      if(notes.length){
        html += '<tr><td colspan="13" style="padding:4px 8px;font-size:11px;color:var(--text2,#b8bccc);background:rgba(255,215,0,.06);text-align:right">'+
          '<i class="fas fa-comment-alt" style="color:var(--gold);margin-left:5px"></i>'+notes.map(n=>'<span style="margin-left:10px"><b style="color:var(--gold)">•</b> '+n.replace(/</g,"&lt;")+'</span>').join(' ')+"</td></tr>";
      }
    }
  }
  html += '</tbody><tfoot><tr><td class="tdn">الإجمالي</td>';
  DAILY_DIMS.forEach(dim=>{
    const s = days.reduce((ss,dd)=>ss+(ev.rows[dd]?+ev.rows[dd][dim[0]]||0:0),0);
    html += '<td style="font-family:monospace;color:var(--gold);font-weight:700">'+s+'</td>';
  });
  html += '<td style="font-family:Cairo;font-weight:800;color:var(--gold)">'+total+' / '+(days.length*100)+'</td></tr></tfoot></table></div></div>';
  return html;
}
function openDailyEvalModal(ev){
  const isNew = !ev;
  const e = isNew ? null : empById(ev.empId); if(!isNew && !e) return;
  const empOpts = DB.filter(isActive).filter(x=>dailyFilter.branch==='all'||x.branch===dailyFilter.branch)
    .map(x=>'<option value="'+x.id+'"'+((ev&&ev.empId===x.id)?' selected':'')+'>'+x.name+' — '+x.job_title+' ('+x.branch+')</option>').join('');
  openModal(
    '<div class="mh"><h3><i class="fas fa-clipboard-check" style="color:var(--green)"></i> '+(isNew?'إنشاء استمارة تقييم جديد':'تقييم '+e.name+' — '+ev.period)+'</h3><button class="mx cm"><i class="fas fa-times"></i></button></div>'+
    '<div class="mb">'+
    (isNew?
      '<div class="fg"><label>الموظف</label><select id="de_emp" style="background:var(--surf2);border:1px solid var(--bord);color:var(--text);border-radius:8px;padding:8px 10px;font-size:12.5px;outline:none">'+empOpts+'</select></div>'+
      '<div class="fg" style="margin-top:10px"><label>الشهر</label><input type="month" id="de_period" value="'+dailyFilter.period+'"></div>':''
    )+
    '<div style="margin-top:12px;font-size:12.5px;color:var(--text2);font-weight:700">درجات اليوم المحدد (كل بُعد من 0 إلى 10 — المجموع 100)</div>'+
    '<div class="fg" style="margin-top:8px"><label>اليوم</label><select id="de_day"></select></div>'+
    '<div id="de_dims"></div>'+
    '<div style="margin-top:12px;padding:10px 12px;background:var(--surf2);border-radius:9px;font-size:12px"><span style="color:var(--text2)">إجمالي اليوم: </span><span id="de_dayTotal" style="font-family:Cairo;font-weight:800;font-size:15px;color:var(--gold)">0 / 100</span></div>'+
    '</div><div class="mf"><button class="btn cm">إلغاء</button><button class="btn btn-add" id="de_save"><i class="fas fa-check"></i> '+(isNew?'إنشاء':'حفظ التقييم')+'</button></div>'
  );
  if(isNew){
    document.getElementById('de_save').onclick = ()=>{
      const empId = +document.getElementById('de_emp').value;
      const period = document.getElementById('de_period').value;
      if(!empId||!period){ toast('اختر الموظف والشهر','err'); return; }
      if(dailyEvalOf(period, empId)){ toast('توجد استمارة لهذا الموظف في هذه الفترة — افتحها للتعديل','err'); return; }
      const emp = empById(empId);
      const newEv = { id: dailyEvalId++, period, empId, rows:{}, by: currentUser ? currentUser.name : 'المدير' };
      DAILY_EVALS.push(newEv);
      logAudit('create','daily_eval',null,null,{ note:'إنشاء استمارة تقييم يومي — '+emp.name+' — '+period });
      closeModal(); toast('تم إنشاء استمارة التقييم — '+emp.name+' — '+period,'ok'); go('kpi');
    };
  } else {
    // تعبئة قائمة الأيام (30 يومًا)
    const daySel = document.getElementById('de_day');
    for(let d=1; d<=30; d++){
      const t = dailyTotal(ev.rows[d]);
      const opt = document.createElement('option');
      opt.value = d; opt.textContent = 'اليوم '+d+(t?(' — '+t+' من 100'):(' — لم يقيّم بعد'));
      if((ev.rows[d]?1:(Object.keys(ev.rows).length?0:1)) && !daySel.querySelector('option[selected]') && d===1) opt.selected = true;
      daySel.appendChild(opt);
    }
    if(!ev.rows[1]) daySel.value='1';
    const dimsWrap = document.getElementById('de_dims');
    const renderDims = ()=>{
      const d = +daySel.value;
      const row = ev.rows[d] || {};
      dimsWrap.innerHTML = DAILY_DIMS.map(dim=>{
        const v = +row[dim[0]]||0;
        const note = row[dim[0]+'_note']||'';
        return '<div class="fg" style="margin-top:8px"><label>'+dim[1]+' <span id="dev_'+dim[0]+'" style="float:left;color:var(--gold);font-family:Cairo;font-weight:800">'+v+'/10</span></label>'+
          '<input type="range" id="devr_'+dim[0]+'" min="0" max="10" value="'+v+'" style="width:100%">'+
          '<textarea id="devn_'+dim[0]+'" placeholder="ملاحظة تفصيلية عن هذا البند..." style="width:100%;margin-top:6px;font-family:Cairo;font-size:12px;padding:5px 8px;border:1px solid var(--border,#3a3f55);border-radius:6px;background:var(--bg2,#16192a);color:var(--text);resize:vertical;min-height:40px;max-height:100px" rows="2">'+note+'</textarea></div>';
      }).join('');
      DAILY_DIMS.forEach(dim=>{
        const inp = document.getElementById('devr_'+dim[0]);
        inp.oninput = ()=>{
          document.getElementById('dev_'+dim[0]).textContent = inp.value+'/10';
          updDayTotal();
        };
      });
      updDayTotal();
    };
    const updDayTotal = ()=>{
      let s=0; DAILY_DIMS.forEach(dim=>s+= +document.getElementById('devr_'+dim[0]).value);
      document.getElementById('de_dayTotal').textContent = s+' / 100';
    };
    daySel.onchange = renderDims;
    renderDims();
    document.getElementById('de_save').onclick = ()=>{
      const d = +daySel.value;
      const row = {};
      DAILY_DIMS.forEach(dim=>{
        row[dim[0]] = +document.getElementById('devr_'+dim[0]).value;
        const n = (document.getElementById('devn_'+dim[0]).value||'').trim();
        if(n) row[dim[0]+'_note'] = n;
      });
      if(!dailyTotal(row)){ delete ev.rows[d]; } else { ev.rows[d] = row; }
      logAudit('edit','daily_eval',null,null,{ note:'تسجيل تقييم يومي — '+e.name+' — يوم '+d+' — '+ev.period });
      closeModal(); toast('تم حفظ تقييم يوم '+d+' — الإجمالي: '+dailyTotal(ev.rows[d])+'/100','ok'); go('kpi');
    };
  }
}
function bindDailyEval(){
  const p = document.getElementById('dPeriod');
  if(p) p.onchange = e=>{ dailyFilter.period = e.target.value; dailyFilter.emp=''; go('kpi'); };
  const b = document.getElementById('dBranch');
  if(b) b.onchange = e=>{ dailyFilter.branch = e.target.value; dailyFilter.emp=''; go('kpi'); };
  const s = document.getElementById('dEmp');
  if(s) s.onchange = e=>{ dailyFilter.emp = e.target.value; go('kpi'); };
  const n = document.getElementById('dNewEval');
  if(n) n.onclick = ()=>openDailyEvalModal(null);
  document.querySelectorAll('.dEdit').forEach(x=>x.onclick=()=>{ const ev=DAILY_EVALS.find(z=>z.id==x.dataset.ev); if(ev) openDailyEvalModal(ev); });
  document.querySelectorAll('.dDel').forEach(x=>x.onclick=()=>{
    const ev=DAILY_EVALS.find(z=>z.id==x.dataset.ev); if(!ev) return;
    const emp=empById(ev.empId);
    confirm2('حذف الاستمارة','حذف استمارة تقييم '+(emp?emp.name:'')+' لشهر '+ev.period+'؟ لا يمكن التراجع عن هذا الإجراء.',()=>{
      DAILY_EVALS = DAILY_EVALS.filter(z=>z.id!==ev.id);
      toast('تم الحذف','ok'); go('kpi');
    });
  });
  document.querySelectorAll('.dPrint').forEach(x=>x.onclick=()=>printDailyEval(+x.dataset.ev));
  const ex = document.getElementById('dExport');
  if(ex) ex.onclick = ()=>{
    const evs = DAILY_EVALS.filter(x=>x.period===dailyFilter.period);
    if(!evs.length){ toast('لا توجد بيانات للتصدير في هذه الفترة','err'); return; }
    const dims = DAILY_DIMS.map(d=>d[1]);
    const rows = evs.flatMap(ev=>{
      const e = empById(ev.empId);
      return Object.keys(ev.rows).map(d=>{
        const r = ev.rows[d];
        const notes = DAILY_DIMS.map(dim=>dim[1]+': '+(r[dim[0]+'_note']||'—')).join(' | ');
      return [ev.period, e?e.code:'-', e?e.name:'-', e?e.branch:'-', e?e.job_title:'-', 'يوم '+d].concat(DAILY_DIMS.map(dim=>r[dim[0]]||'')).concat([dailyTotal(r)]).concat([notes]);
      });
    });
    dlCSV(['الشهر','الكود','الموظف','الفرع','الوظيفة','اليوم'].concat(dims).concat(['إجمالي اليوم','ملاحظات البنود']), rows, 'daily-evaluation-'+dailyFilter.period+'.csv');
    toast('تم تصدير التقييم اليومي','ok');
  };
}
function printDailyEval(evId){
  const ev = DAILY_EVALS.find(x=>x.id===evId); if(!ev) return;
  const e = empById(ev.empId); if(!e) return;
  const days = Object.keys(ev.rows).map(Number).sort((a,b)=>a-b);
  const total = dailyPeriodTotals(ev);
  let rows = '';
  for(let d=1; d<=30; d++){
    const r = ev.rows[d]||{};
    rows += '<tr'+(r?' class="filled"':'')+'><td>'+d+'</td>';
    DAILY_DIMS.forEach(dim=>rows+='<td>'+(r[dim[0]]||'—')+'</td>');
    rows += '<td class="tot">'+(r?dailyTotal(r):'—')+'</td></tr>';
    const rNotes = DAILY_DIMS.map(dim=>(r[dim[0]+'_note']||'')).filter(n=>n);
    if(rNotes.length){
      rows += '<tr class="notes"><td colspan="13" style="text-align:right;font-size:9px;color:#555">'+rNotes.map(n=>'<b style="color:#c8102e">•</b> '+n.replace(/</g,'&lt;')).join(' &nbsp; ')+'</td></tr>';
    }
  }
  const w = window.open('', '_blank');
  w.document.write('<!DOCTYPE html><html dir="rtl" lang="ar"><head><meta charset="utf-8"><title>تقييم الموظف — '+e.name+'</title>'+
    '<style>@page{size:A4 landscape;margin:12mm}body{font-family:\'Cairo\',sans-serif;color:#222;margin:0}'+
    'table{width:100%;border-collapse:collapse;font-size:11px}th,td{border:1px solid #444;padding:4px 6px;text-align:center}'+
    'th{background:#eee}tr.filled{background:#f8f8f8}td.tot{font-weight:800}tr.notes td{border-style:dashed;padding:3px 6px}'+
    '.head{display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;border-bottom:2px solid #c8102e;padding-bottom:8px}'+
    '.head h2{margin:0;font-size:17px}.head .meta{font-size:12px;color:#555;text-align:left}</style></head><body>'+
    '<div class="head"><div><h2>تقييم الموظف – '+e.name+' – في شهر '+ev.period+'</h2><div class="meta">'+e.job_title+' — '+e.branch+' — إعداد: '+ev.by+'</div></div>'+
    '<div class="meta"><div><b>إجمالي درجات التقييم: '+total+' / '+(days.length*100)+'</b></div></div></div>'+
    '<table><thead><tr><th>م / اليوم</th>'+DAILY_DIMS.map(d=>'<th>'+d[1]+'</th>').join('')+'<th>إجمالي اليوم</th></tr></thead><tbody>'+rows+'</tbody></table>'+
    '<script>window.print();<\/script></body></html>');
  w.document.close();
}

// ═══════════════════════════════════════════════════════════════════════
// الجزء 6 من 6: عرض التقييم اليومي في واجهة الموظف (اختياري)
// الموضع: أول دالة selfKPIHTML() — الصق الكتلة التالية كاملة في بداية الدالة:
//   (تعرض للموظف استمارته الشخصية: الإجمالي، المتوسط، الجدول اليومي)
// ═══════════════════════════════════════════════════════════════════════
function selfKPIHTML(){
  const e = selfEmp();
  const k = KPI_SCORES[e.id] || {};
  const labels = {commitment:'الالتزام',attendance:'الحضور',speed:'السرعة',quality:'الجودة',service:'خدمة العملاء',cleanliness:'النظافة',discipline:'الانضباط',teamwork:'العمل الجماعي'};
  const score = kpiScore(e.id);
  const grade = kpiGrade(score);
  // التقييم اليومي للموظف (استمارة التقييم الشهرية) — آخر فترة متاحة له
  const myEvals = DAILY_EVALS.filter(x=>x.empId===e.id).sort((a,b)=>b.period.localeCompare(a.period));
  const myEval = myEvals[0] || null;
  let selfDaily = '';
  if(myEval){
    const mTotal = dailyPeriodTotals(myEval);
    const mDays = Object.keys(myEval.rows).length;
    const mAvg = dailyAvgScore(myEval);
    selfDaily = '<div class="self-card" style="background:linear-gradient(135deg,var(--surf) 0%,var(--surf2) 100%)">'+
      '<div style="font-weight:800;margin-bottom:8px"><i class="fas fa-clipboard-check" style="color:var(--green)"></i> تقييمي اليومي — شهر '+myEval.period+'</div>'+
      '<div style="display:flex;gap:10px;flex-wrap:wrap;font-size:12.5px;margin-bottom:10px">'+
        '<div style="flex:1;min-width:110px;padding:8px 10px;background:var(--surf);border-radius:9px;text-align:center"><div style="font-family:Cairo;font-weight:800;font-size:17px;color:var(--gold)">'+mTotal+'</div><div style="font-size:10.5px;color:var(--text2)">إجمالي درجات التقييم</div></div>'+
        '<div style="flex:1;min-width:110px;padding:8px 10px;background:var(--surf);border-radius:9px;text-align:center"><div style="font-family:Cairo;font-weight:800;font-size:17px;color:'+kpiGrade(mAvg).c+'">'+mAvg+'%</div><div style="font-size:10.5px;color:var(--text2)">متوسط الأداء</div></div>'+
        '<div style="flex:1;min-width:110px;padding:8px 10px;background:var(--surf);border-radius:9px;text-align:center"><div style="font-family:Cairo;font-weight:800;font-size:17px;color:var(--blue)">'+mDays+'</div><div style="font-size:10.5px;color:var(--text2)">يوم مقيّم</div></div>'+
      '</div>'+
      '<div class="tw" style="max-height:300px;overflow-y:auto"><table><thead><tr><th style="width:50px">اليوم</th>'+DAILY_DIMS.map(d=>'<th>'+d[1]+'</th>').join('')+'<th style="width:70px">اليومي</th></tr></thead><tbody>'+
      Array.from({length:30},(_,i)=>i+1).map(d=>{
        const r = myEval.rows[d]||null;
        return '<tr><td class="tdn"><span class="chip">'+d+'</span></td>'+
          DAILY_DIMS.map(dim=>'<td style="color:'+(r?'var(--text)':'var(--text3)')+';font-weight:'+(r?'700':'400')+'">'+(r?(r[dim[0]]||0):'—')+'</td>').join('')+
          '<td style="font-family:Cairo;font-weight:800;color:'+(r?'var(--gold)':'var(--text3)')+'">'+(r?dailyTotal(r):'—')+'</td></tr>';
      }).join('')+
      '</tbody></table></div>'+
    '</div>';
  } else {
    selfDaily = '<div class="self-card"><div style="font-size:12px;color:var(--text2)"><i class="fas fa-clipboard-check"></i> لم يتم إنشاء استمارة تقييم يومي لك بعد — ستظهر هنا فور إعدادها من قبل الإدارة</div></div>';
  }
  return selfDaily + (
    '<div class="self-card" style="text-align:center">'+
      '<div style="font-size:34px;font-weight:800;color:'+grade.c+'">'+score+'</div>'+
      '<div style="font-size:13px;font-weight:700;color:'+grade.c+'">'+grade.t+'</div>'+
    '</div>'+
    '<div class="self-card">'+
      Object.keys(labels).map(key=>{
        const v = k[key]||0;
        const col = v>=80?'var(--green)':v>=65?'var(--gold)':'var(--red)';
        return '<div class="kpi-bar-row"><div class="lb">'+labels[key]+'</div><div class="track"><div class="fill" style="width:'+v+'%;background:'+col+'"></div></div><div class="val">'+v+'</div></div>';
      }).join('')+
    '</div>'
  );
}
// ═══════════════════════════════════════════════════════════════════════
// سكربت التحقق التلقائي من الدمج (يُشغّل بعد الدمج):
//   1) افتح ملف النظام في المتصفح وسجّل دخول بحساب مدير
//   2) افتح وحدة التحكم (F12) واكتب: checkDailyEvalAddon()
//   3) يجب أن تظهر رسالة: ✔ ملحق تقييم الموظفين مدمج بالكامل
// ═══════════════════════════════════════════════════════════════════════
function checkDailyEvalAddon(){
  const ok = []; const fail = [];
  const required = ['DAILY_DIMS','DAILY_EVALS','dailyEvalId','dailyFilter','dailyEvalOf',
    'dailyTotal','dailyPeriodTotals','dailyAvgScore','dailyEvalHTML','bindDailyEval',
    'openDailyEvalModal','printDailyEval','seedDailyEvalData'];
  required.forEach(n=>{ if(window[n]!==undefined) ok.push(n); else fail.push(n); });
  const hasTab = (document.documentElement.innerHTML||'').includes('تقييم الموظفين</button>');
  const hasBind = /kpiTab==='daily'/.test(document.documentElement.innerHTML||'');
  console.table({ok:ok.length, fail:fail.length});
  if(ok.length===required.length && hasTab && hasBind){
    console.log('✔ ملحق تقييم الموظفين مدمج بالكامل');
  } else {
    console.log('✘ الدمج غير مكتمل — العناصر المفقودة:', fail.join(', '),
      !hasTab ? '| تاب الصفحة' : '', !hasBind ? '| شرط bindKPI' : '');
  }
}
