
var map, geoJsonLayer;
var wmsLayers = [];
var allData = [];

// should be filled or empty;
var renderDemand = 'empty';
var currentPoints = null;
var lastRespPoints = null;

var map = require('./map');
var huc = require('./huc');
var file = require('./file');

$(document).on('ready', function(){
  resize();
  init();
});

$(window)
  .on('resize', resize);

function init() {
  map.init();
  huc.init(map.getLeaflet());

  file.setup(); // setup dom handlers for file

  map.legend.init();
  map.setHuc(huc);
}

function resize() {
  // why is this not working???
  //$('#map').height($(window).height())
  //     .width($(window).width());

  var h = window.innerHeight;
  var w = window.innerWidth;
  if( h === null ) h = $(window).height();
  if( w === null ) w = $(window).width();

  $('#map').height(h).width(w);
  $('#info').css('max-height', (h-85)+'px');
}

module.exports = {
  map : map,
  huc : huc,
  file : file
};
