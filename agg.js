/* Funciones de agregación — compartidas con la página y verificables por separado */
var MESES = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Set','Oct','Nov','Dic'];

function filtrar(data, year) {
  return year === 'all' ? data.slice() : data.filter(function (r) { return r.y === +year; });
}

function kpis(data, year) {
  var f = filtrar(data, year);
  var usd = f.filter(function (r) { return r.mo === 'USD'; });
  var eur = f.filter(function (r) { return r.mo === 'EUR'; });
  var sum = function (a) { return a.reduce(function (s, r) { return s + r.v; }, 0); };
  var totUsd = sum(usd);
  var dl = usd.filter(function (r) { return r.p === 'DR. LAZAR'; });
  return {
    totUsd: totUsd,
    totEur: sum(eur),
    nFact: f.length,
    nUsd: usd.length,
    nEur: eur.length,
    promUsd: usd.length ? totUsd / usd.length : 0,
    drLazar: sum(dl),
    drLazarPct: totUsd ? (sum(dl) / totUsd) * 100 : 0,
    terceros: totUsd - sum(dl),
    nTerceros: usd.length - dl.length
  };
}

/* Serie mensual. year='all' → una línea por año; año concreto → top N proveedores + Otros */
function evolucion(data, year, topN) {
  topN = topN || 5;
  var usd = data.filter(function (r) { return r.mo === 'USD'; });
  var filas = MESES.map(function (m, i) { return { mes: m, _i: i + 1 }; });
  var series;
  if (year === 'all') {
    series = ['2025', '2026'];
    usd.forEach(function (r) {
      var f = filas[r.mes - 1];
      f[String(r.y)] = (f[String(r.y)] || 0) + r.v;
    });
  } else {
    var año = usd.filter(function (r) { return r.y === +year; });
    var porProv = {};
    año.forEach(function (r) { porProv[r.p] = (porProv[r.p] || 0) + r.v; });
    var orden = Object.keys(porProv).sort(function (a, b) { return porProv[b] - porProv[a]; });
    var top = orden.slice(0, topN);
    var hayOtros = orden.length > topN;
    series = top.concat(hayOtros ? ['Otros'] : []);
    año.forEach(function (r) {
      var k = top.indexOf(r.p) >= 0 ? r.p : 'Otros';
      var f = filas[r.mes - 1];
      f[k] = (f[k] || 0) + r.v;
    });
  }
  filas.forEach(function (f) {
    series.forEach(function (s) { if (f[s] === undefined) f[s] = 0; });
    f.total = series.reduce(function (s, k) { return s + (f[k] || 0); }, 0);
  });
  return { filas: filas, series: series };
}

function porMercaderia(data, year, incluirVarios, limite) {
  var f = filtrar(data, year).filter(function (r) { return r.mo === 'USD'; });
  if (!incluirVarios) f = f.filter(function (r) { return r.t !== 'Varios – Dr. Lazar'; });
  var acc = {};
  f.forEach(function (r) {
    if (!acc[r.m]) acc[r.m] = { merc: r.m, valor: 0, n: 0, clase: r.k, tipo: r.t };
    acc[r.m].valor += r.v; acc[r.m].n += 1;
  });
  var arr = Object.keys(acc).map(function (k) { return acc[k]; });
  arr.sort(function (a, b) { return b.valor - a.valor; });
  return limite ? arr.slice(0, limite) : arr;
}

function porTipo(data, year) {
  var f = filtrar(data, year).filter(function (r) { return r.mo === 'USD'; });
  var acc = {};
  f.forEach(function (r) {
    if (!acc[r.t]) acc[r.t] = { name: r.t, value: 0, n: 0 };
    acc[r.t].value += r.v; acc[r.t].n += 1;
  });
  var total = f.reduce(function (s, r) { return s + r.v; }, 0);
  var arr = Object.keys(acc).map(function (k) { return acc[k]; });
  arr.sort(function (a, b) { return b.value - a.value; });
  arr.forEach(function (d) { d.pct = total ? (d.value / total) * 100 : 0; });
  return arr;
}

/* Clases terapéuticas: solo principios activos */
function porClase(data, year) {
  var f = filtrar(data, year).filter(function (r) { return r.mo === 'USD' && r.t === 'Principio activo'; });
  var acc = {};
  f.forEach(function (r) {
    if (!acc[r.k]) acc[r.k] = { clase: r.k, valor: 0, n: 0 };
    acc[r.k].valor += r.v; acc[r.k].n += 1;
  });
  var arr = Object.keys(acc).map(function (k) { return acc[k]; });
  arr.sort(function (a, b) { return b.valor - a.valor; });
  var total = arr.reduce(function (s, d) { return s + d.valor; }, 0);
  arr.forEach(function (d) { d.pct = total ? (d.valor / total) * 100 : 0; });
  return arr;
}

/* Estacionalidad: matriz año × mes + media mensual entre años con dato */
function estacionalidad(data) {
  var usd = data.filter(function (r) { return r.mo === 'USD'; });
  var años = [2025, 2026];
  var ultimoMes = {};
  años.forEach(function (y) {
    var ms = usd.filter(function (r) { return r.y === y; }).map(function (r) { return r.mes; });
    ultimoMes[y] = ms.length ? Math.max.apply(null, ms) : 0;
  });
  var matriz = años.map(function (y) {
    var celdas = MESES.map(function (m, i) {
      var mes = i + 1;
      var rows = usd.filter(function (r) { return r.y === y && r.mes === mes; });
      return {
        anio: y, mes: mes, label: m,
        valor: rows.reduce(function (s, r) { return s + r.v; }, 0),
        n: rows.length,
        futuro: mes > ultimoMes[y]
      };
    });
    return { anio: y, celdas: celdas };
  });
  var max = 0;
  matriz.forEach(function (f) { f.celdas.forEach(function (c) { if (!c.futuro && c.valor > max) max = c.valor; }); });
  var medias = MESES.map(function (m, i) {
    var mes = i + 1;
    var vals = matriz.map(function (f) { return f.celdas[mes - 1]; }).filter(function (c) { return !c.futuro; });
    var suma = vals.reduce(function (s, c) { return s + c.valor; }, 0);
    return { mes: m, media: vals.length ? suma / vals.length : 0, años: vals.length };
  });
  return { matriz: matriz, medias: medias, max: max, ultimoMes: ultimoMes };
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { MESES: MESES, filtrar: filtrar, kpis: kpis, evolucion: evolucion, porMercaderia: porMercaderia, porTipo: porTipo, porClase: porClase, estacionalidad: estacionalidad };
}
