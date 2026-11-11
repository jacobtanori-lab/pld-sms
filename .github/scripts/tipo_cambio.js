// Combina la respuesta del SIE de Banxico con el historico de
// data/tipo_cambio.json. Lo usa el workflow "Tipo de cambio (Banxico FIX)".
//
//   node tipo_cambio.js crudo.json data/tipo_cambio.json
//
// El dolar (SF60653, FIX) sigue en "tasas", donde la app lo ha leido siempre;
// las demas monedas van en "monedas", cada una con su serie y sus tasas.

var SERIE_USD = 'SF60653';
var OTRAS = { EUR: 'SF46410', JPY: 'SF46406', GBP: 'SF46407', CNY: 'SF290383' };
var NOTA = 'Tipos de cambio cruzados con base en el tipo de cambio FIX publicado por el Banco de México '
  + 'y en los tipos de cambio promedio de mercado para el euro, yen japonés, libra esterlina y yuan chino '
  + 'frente al dólar que da a conocer diariamente el Fondo Monetario Internacional (FMI).';

// { 'SF60653': { 'AAAA-MM-DD': 18.62 }, ... } a partir de la respuesta del SIE.
function seriesDeRespuesta(crudo) {
  var res = {};
  var series = (crudo && crudo.bmx && crudo.bmx.series) || [];
  series.forEach(function (s) {
    var m = {};
    (s.datos || []).forEach(function (d) {
      if (!d || d.dato === 'N/E' || !/^\d{2}\/\d{2}\/\d{4}$/.test(d.fecha || '')) return;
      var v = parseFloat(String(d.dato).replace(/,/g, ''));
      if (!(v > 0)) return;
      m[d.fecha.substring(6, 10) + '-' + d.fecha.substring(3, 5) + '-' + d.fecha.substring(0, 2)] = v;
    });
    res[s.idSerie] = m;
  });
  return res;
}

function ordenar(m) {
  var o = {};
  Object.keys(m).sort().forEach(function (k) { o[k] = m[k]; });
  return o;
}

// prev: el archivo actual (o null); crudo: la respuesta del SIE.
function combinar(prev, crudo, ahora) {
  prev = prev || {};
  var nuevas = seriesDeRespuesta(crudo);
  var usd = ordenar(Object.assign({}, prev.tasas || {}, nuevas[SERIE_USD] || {}));
  var monedas = {};
  Object.keys(OTRAS).forEach(function (iso) {
    var antes = (prev.monedas && prev.monedas[iso] && prev.monedas[iso].tasas) || {};
    var t = ordenar(Object.assign({}, antes, nuevas[OTRAS[iso]] || {}));
    monedas[iso] = { serie: OTRAS[iso], total: Object.keys(t).length, tasas: t };
  });
  return {
    fuente: 'BANXICO_DOF_' + SERIE_USD,
    actualizado: ahora || new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'),
    total: Object.keys(usd).length,
    tasas: usd,
    nota_otras_monedas: NOTA,
    monedas: monedas
  };
}

if (typeof module !== 'undefined' && require.main === module) {
  var fs = require('fs');
  var crudo = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
  var destino = process.argv[3];
  var prev = fs.existsSync(destino) ? JSON.parse(fs.readFileSync(destino, 'utf8')) : null;
  var sal = combinar(prev, crudo);
  fs.writeFileSync(destino, JSON.stringify(sal, null, 2) + '\n');
  var n = seriesDeRespuesta(crudo);
  console.log('Fechas obtenidas por serie: ' + Object.keys(n).map(function (k) { return k + '=' + Object.keys(n[k]).length; }).join(', '));
  console.log('USD acumulado: ' + sal.total + '; ' + Object.keys(sal.monedas).map(function (k) { return k + ' ' + sal.monedas[k].total; }).join(', '));
}

if (typeof module !== 'undefined') module.exports = { combinar: combinar, seriesDeRespuesta: seriesDeRespuesta };
