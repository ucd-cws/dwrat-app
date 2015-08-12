(function(f){if(typeof exports==="object"&&typeof module!=="undefined"){module.exports=f()}else if(typeof define==="function"&&define.amd){define([],f)}else{var g;if(typeof window!=="undefined"){g=window}else if(typeof global!=="undefined"){g=global}else if(typeof self!=="undefined"){g=self}else{g=this}g.DWRAT = f()}})(function(){var define,module,exports;return (function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
var data = {
  all : [],
  noDemand : [],
  features : []
};

module.exports.set = function(points) {
  data.all = points;

  tmp = [];
  for( var i = points.length-1; i >= 0; i-- ) {
    if( points[i].properties.allocations && points[i].properties.allocations.length > 0 ) {

      var demand = points[i].properties.allocations[0].demand;
      if( demand !== 0 ) tmp.push(points[i]);
    }
  }
  data.noDemand = tmp;
};

module.exports.get = function(noDemand) {
  if( noDemand ) return data.noDemand;
  return data.all;
};

module.exports.clearFeatures = function(){
  data.features = [];
};

module.exports.addFeature = function(feature) {
  data.features.push(feature);
};

module.exports.getFeatures = function() {
  return data.features;
};

},{}],2:[function(require,module,exports){
var process = require('./process');

var HEADERS = {
    application_number : {
        required : true,
        type : 'string'
    },
    demand_date : {
        required : true,
        type : 'date-string'
    },
    watershed : {
        required : false,
        type : 'string'
    },
    season : {
        required : false,
        type : 'boolean',
    },
    'huc-12' : {
        required : false,
        type : 'boolean'
    },
    water_right_type : {
        required : false,
        type : 'string'
    },
    priority_date : {
        required : true,
        type : 'date-string'
    },
    riparian : {
        required : false,
        type : 'boolean'
    },
    pre1914 : {
        required : false,
        type : 'boolean'
    },
    demand : {
        required : true,
        type : 'float'
    },
    allocation : {
        required : true,
        type : 'float'
    }
};

var locations = {}, map, datastore;


function createGeoJson(data, attrMap, callback) {
    // first locate data
    $('#file-locate').html('Locating data...');

    var ids = [], key;
    var col = getAttrCol('application_number', data, attrMap);
    for( var i = 1; i < data.length; i++ ) {
        var id = data[i][col];
        if( !locations[id] ) ids.push(data[i][col]);
    }

    locateData(0, ids, function(){

        $('#file-locate').html('Creating data...');

        var iMap = {};
        for( key in attrMap ) iMap[attrMap[key]] = key;

        var geoJson = [];
        for( var i = 1; i < data.length; i++ ) {
            if( !locations[data[i][col]] ) continue;

            var p = {
                type : 'Feature',
                geometry : $.extend({}, true, locations[data[i][col]]),
                properties : {}
            };

            for( var j = 0; j < data[0].length; j++ ) {
                key = data[0][j];
                if( iMap[key] ) key = iMap[key];
                p.properties[key] = (HEADERS[key] && HEADERS[key].type == 'float') ? parseFloat(data[i][j]) : data[i][j];
            }

            p.properties.allocations = [{
                season : true,
                allocation : p.properties.allocation,
                demand : p.properties.demand,
                forecast : false,
                date : p.properties.demand_date,
                public_health_bind : false,
                wrbind : false,
                ratio : (p.properties.demand > 0) ? (p.properties.allocation / p.properties.demand) : 0
            }];

            geoJson.push(p);
        }

        map.clearGeojsonLayer();
        datastore.set(geoJson);
        map.geojson.add(geoJson);

        $('#file-locate').html('');
        callback();
    });
}

function getAttrCol(attr, data, map) {
    if( map[attr] ) return data[0].indexOf(map[attr]);
    return data[0].indexOf(attr);
}

function locateData(index, ids, callback) {
    if( index+1 >= ids.length ) {
        callback();
    } else {
        var idGroup = [];

        var i = 0;
        for( i = index; i < index+200; i++ ) {
            if( ids.length == i ) break;
            idGroup.push(ids[i]);
        }
        index += 200;
        console.log(index);



        var query = new google.visualization.Query('http://watershed.ice.ucdavis.edu/vizsource/rest?view=locate(\''+
            idGroup.join(',')+'\')&tq=SELECT *');
        query.send(function(resp){
            if( resp.isError() ) {
                console.log(resp.getMessage());
            } else {
                var dt = resp.getDataTable();
                for( var i = 0; i < dt.getNumberOfRows(); i++ ) {
                    locations[dt.getValue(i, 0)] = JSON.parse(dt.getValue(i, 2));
                }
            }

            $('#file-locate').html('Locating data '+((index/ids.length).toFixed(2)*100)+'%...');
            locateData(index, ids, callback);
        });
    }
}



var file = {
  HEADERS : HEADERS,
  init : function(options){
    map = options.map;
    datastore = options.datastore;
    options.file = this;

    require('./setup')(process);
    process.init(options);
  },
  createGeoJson : createGeoJson,
  process : process
};


module.exports = file;

},{"./process":4,"./setup":5}],3:[function(require,module,exports){
module.exports = function(type, contents, callback) {
    if( type == 'xlsx' ) {
        try {
            function onXlsxComplete(wb){
                selectWorksheet(wb.SheetNames, function(sheetName){
                    var csv = XLSX.utils.sheet_to_csv(wb.Sheets[sheetName]);
                    $.csv.toArrays(csv, {}, function(err, data){
                        if( err ) return callback(err);
                        callback(null, data);
                    });
                });
            }

            var worker = new Worker('bower_components/js-xlsx/xlsxworker.js');
            worker.onmessage = function(e) {
                switch(e.data.t) {
                    case 'ready': break;
                    case 'e': console.error(e.data.d); break;
                    case 'xlsx': onXlsxComplete(JSON.parse(e.data.d)); break;
                }
            };
            worker.postMessage({d:contents,b:true});

        } catch(e) {
            callback(e);
        }

    } else if( info.ext == 'xls' ) {
        try {
            function onXlsComplete(wb){
                selectWorksheet(wb.SheetNames, function(sheetName){
                    var csv = XLS.utils.sheet_to_csv(wb.Sheets[sheetName]);
                    $.csv.toArrays(csv, {}, function(err, data){
                        if( err ) return callback(err);
                        callback(null, data);
                    });
                });
            }

            var worker = new Worker('bower_components/js-xls/xlsworker.js');
            worker.onmessage = function(e) {
                switch(e.data.t) {
                    case 'ready': break;
                    case 'e': console.error(e.data.d); break;
                    case 'xlsx': onXlsComplete(JSON.parse(e.data.d)); break;
                }
            };
            worker.postMessage({d:contents,b:true});

        } catch(e) {
            debugger;
            this.onComplete(e, null, info, 1, 1, arr, callback);
        }
    } else {
        try {
            var options = {};
            //if( info.parser == 'csv-tab' ) options.separator = '\t';

            $.csv.toArrays(contents, options, function(err, data){
                if( err ) return callback(err);
                callback(null, data);
            }.bind(this));
        } catch(e) {
            debugger;
            this.onComplete(e, null, info, 1, 1, arr, callback);
        }
    }
}

},{}],4:[function(require,module,exports){
var parse = require('./parse');
var previousAttrMap = {};

var file, map, filename = '', huc;

module.exports.init = function(options) {
  file = options.file;
  map = options.map;
  huc = options.huc;
};

// process a file
module.exports.run = function(e) {
  e.stopPropagation();
  e.preventDefault();
  var files = e.dataTransfer ? e.dataTransfer.files : e.target.files; // FileList object.

  if( files.length > 0 ) {
    $('#file-locate').html('Loading file...');
    filename = files[0].name;
    read(files[0]);
  }
};

module.exports.setFilename = function(name) {
  filename = name;
};

function importContents(type, contents, callback) {
  parse(type, contents, onFileParsed);
}
module.exports.importContents = importContents;

function onFileParsed(err, data) {
  $('#file-locate').html('');
  matchCols(data, function(colMap){

    // now locate data and create
    file.createGeoJson(data, colMap, updateUiPostImport);
  });
}

function updateUiPostImport() {
  $('#date-selection').hide();
  $('#file-selection').html(filename+' <a class="btn btn-default" id="remove-file-btn"><i class="fa fa-times"></i></a>');

  $('#remove-file-btn').on('click',function(){
    map.geojson.clearLayer();
    huc.clear();
    $('#date-selection').show();
    $('#file-selection').html('');
  });

  $('#file-input').val('');
  $('#file-modal').modal('hide');
}

function read(raw) {
    _resetUI();

    var type = 'text';

    var reader = new FileReader();
    reader.onload = function(e) {
        importContents(type, e.target.result);
    };

    if( raw.name.match(/.*\.xlsx?$/) ) {
        type = raw.name.replace(/.*\./,'');
        reader.readAsBinaryString(raw);
    } else {
        reader.readAsText(raw);
    }
}

function matchCols(data, callback) {
    if( data.length == 0 ) return alert('Your file is empty');

    var matches = [];
    var requiredMismatches = [];
    var mapped = previousAttrMap;

    var flatten = [];
    for( var i = 0; i < data[0].length; i++ ) {
      flatten.push(data[0][i].toLowerCase());
    }

    for( var key in file.HEADERS ) {
        if( previousAttrMap[key] ) {
            matches.push(key);
        } else if( flatten.indexOf(key.toLowerCase()) == -1 && file.HEADERS[key].required ) {
            requiredMismatches.push(key);
        } else if( flatten.indexOf(key.toLowerCase()) > -1 ) {
          if( data[0].indexOf(key) > -1 ) {
            matches.push(key);
          } else { // the case differs, add it to the attribute map
            var index = flatten.indexOf(key.toLowerCase());
            previousAttrMap[key] = data[0][index];
          }
        }
    }

    if( requiredMismatches.length == 0 ) return callback(previousAttrMap);

    var table = '<table class="table">';
    for( var i = 0; i < requiredMismatches.length; i++ ) {
        table += '<tr><td>'+requiredMismatches[i]+'</td><td>'+_createMatchSelector(requiredMismatches[i], data[0], matches)+'</td></tr>';
    }
    table += '</table>';

    $('#matchTable').html('<div style="margin-top:20px;font-weight:bold">Please match the following required columns to continue</div>'+table);
    $('.match-selector').on('change', function(){
        var key = $(this).attr('key');
        var val = $(this).val();

        if( val == '' || !val ) {
            delete mapped[key];
            requiredMismatches.push(key);
        } else {
            mapped[key] = val;
            var index = requiredMismatches.indexOf(key);
            if (index > -1) requiredMismatches.splice(index, 1);
        }


        if( requiredMismatches.length == 0 ) {
            $('#matchTable').html('');
            previousAttrMap = mapped;
            callback(mapped);
        }
    });
}


function _resetUI() {
    $('#matchTable').html('');
    $('#file-locate').html('');
}

function _createMatchSelector(key, arr, matches) {
    var select = '<select class="match-selector" key="'+key+'"><option></option>';

    for( var i = 0; i < arr.length; i++ ) {
        if( matches.indexOf(arr[i]) > -1 ) continue;
        select += '<option value="'+arr[i]+'">'+arr[i]+'</option>';
    }
    return select + '</select>';
}

function selectWorksheet(sheetNames, callback) {
    console.log(sheetNames);

    if( sheetNames.length == 1 ) callback(sheetNames[0]);

    // add UI interaction here
    callback(sheetNames[0]);
}

},{"./parse":3}],5:[function(require,module,exports){
module.exports = function(process) {
  $('#close-popup').on('click', function(){
    $('#info').removeClass('fadeInDown').addClass('slideOutRight');

    select(null);
    setTimeout(function(){
      $('#info').hide().addClass('fadeInDown').removeClass('slideOutRight');
    }, 800);
  });

  // file upload stuff
  $('#file-modal').modal({show:false});
  $('#file-input').on('change', function(e) {
    process.run(e);
  });
  $('#upload-btn').on('click', function(){
    $('#file-modal').modal('show');
  });

  $('body').on('dragover', function(e){
    e.preventDefault();
    e.stopPropagation();

    $('#upload-drop-message').show();
    $('#wrapper').css('opacity', 0.3);
  }).on('dragleave', function(e){
    e.preventDefault();
    e.stopPropagation();

    $('#upload-drop-message').hide();
    $('#wrapper').css('opacity',1);
  }).on('drop', function(e){
    $('#upload-drop-message').hide();
    $('#wrapper').css('opacity',1);

    process.run(e.originalEvent);
    $('#file-modal').modal('show');

  });
};

},{}],6:[function(require,module,exports){
var markerConfig = require('../markers/config');

var map;
var layers = [];
var pointsByHuc = {};
var urlPrefix = 'http://watershed.ice.ucdavis.edu/vizsource/rest?view=get_huc_by_id(\'';
var urlPostix = '\')&tq=SELECT *';

var hucCache = {};
var requested = {};

var showing = true;
var currentPoints = null;

function init(options) {
  map = options.map.getLeaflet();

  $('#renderHucAvg').on('change', function(){
    showing = $(this).is(':checked');
    onVisibilityUpdate(showing);
  });
}

function onVisibilityUpdate() {
  if( !showing ) {
    clear();
  } else if( currentPoints !== null ){
    render(currentPoints);
  }
}

function clear() {
  // clear all layers
  for( var i = 0; i < layers.length; i++ ) {
    map.removeLayer(layers[i]);
  }
  layers = [];
  pointsByHuc = {};
}

function render(points) {
  currentPoints = points;
  if( !showing ) return;

  clear();

  // organize points by huc
  var huc;
  for( var i = 0; i < currentPoints.length; i++ ) {
    // TODO: did quinn change this?
    huc = points[i].properties['huc-12'] || points[i].properties.huc_12;

    if( pointsByHuc[huc] ) pointsByHuc[huc].push(points[i]);
    else pointsByHuc[huc] = [points[i]];
  }

  // request missing huc geojson and/or render huc
  for( var huc in pointsByHuc ) {
    if( huc === undefined || huc === 'undefined' ) {
      debugger;
      continue;
    }

    if( hucCache[huc] ) renderHuc(huc);
    else if( !requested[huc] ) request(huc);
  }
}

function request(hucId) {
  requested[hucId] = 1;

  var query = new google.visualization.Query(urlPrefix+hucId+urlPostix);
  query.setTimeout(60*5); // 5 min timeout
  query.send(function(response){
    if (response.isError() ) return alert('Error retrieving HUC 12 data for id "'+hucId+'"');

    var data = response.getDataTable();

    if( data.getNumberOfRows() == 0 ) {
      debugger;
      return alert('Error: invalid HUC 12 id "'+hucId+"'");
    }

    var geometry = JSON.parse(data.getValue(0, 0));
    var geojsonFeature = {
      "type": "Feature",
      "properties": {
          "id": hucId,
      },
      "geometry": geometry
    };
    hucCache[hucId] = geojsonFeature;

    renderHuc(hucId);
  });
}

function renderHuc(id) {
  if( !showing ) return;

  var points = pointsByHuc[id];

  // calculate percent demand
  var percentDemands = [], feature;
  for( var i = 0; i < points.length; i++ ) {
    feature = points[i];

    if( feature.properties.allocations && feature.properties.allocations.length > 0 ) {
      var demand = feature.properties.allocations[0].demand;
      var allocation = feature.properties.allocations[0].allocation;

      if( demand != 0 ) {
        percentDemands.push(allocation / demand);
      }
    }
  }

  // calc average
  var avgPrecentDemand = -1;
  var tmp = 0;
  for( var i = 0; i < percentDemands.length; i++ ) {
    tmp += percentDemands[i];
  }
  if( percentDemands.length > 0 ) avgPrecentDemand = tmp / percentDemands.length;

  var layer = L.geoJson(
    hucCache[id],
    {
      style: function(feature) {
        return markerConfig.percentDemandHuc(avgPrecentDemand);
      }
    }
  ).addTo(map);

  layers.push(layer);
}

module.exports = {
  init : init,
  render : render,
  clear : clear
};

},{"../markers/config":15}],7:[function(require,module,exports){
require('./leaflet'); // import custom markers to leaflet namespace (global)
var map = require('./map');
var huc = require('./huc');
var file = require('./file');
var directory = require('./library');
var datastore = require('./datastore');


var map, geoJsonLayer;
var wmsLayers = [];
var allData = [];

// should be filled or empty;
var renderDemand = 'empty';
var currentPoints = null;
var lastRespPoints = null;

$(document).on('ready', function(){
  resize();
  init();
});

$(window)
  .on('resize', resize);

function init() {
  map.init({
    datastore : datastore,
    huc : huc
  });

  huc.init({
    datastore : datastore,
    map : map
  });

  file.init({
    datastore : datastore,
    map : map,
    huc : huc
  });

  // quickly loads /testdata/SacRiver.csv for testing
  // require('./test')(file);
}

function resize() {
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
  file : file,
  directory : directory,
  ds : datastore
};

},{"./datastore":1,"./file":2,"./huc":6,"./leaflet":10,"./library":12,"./map":14}],8:[function(require,module,exports){
var IconRenderer = require('../markers/iconRenderer');

L.Icon.Canvas = L.Icon.extend({
    options: {
        iconSize: new L.Point(20, 20), // Have to be supplied
        className: 'leaflet-canvas-icon'
    },

    createIcon: function () {
        var e = document.createElement('canvas');
        this._setIconStyles(e, 'icon');

        e.width = this.options.width;
        e.height = this.options.height;

        e.style.marginTop = (-1*this.options.width/2)+'px';
        e.style.marginLeft = (-1*this.options.height/2)+'px';

        e.style.width = this.options.width+'px';
        e.style.height =this.options.height+'px';

        this.draw(e.getContext('2d'));

        return e;
    },

    createShadow: function () {
        return null;
    },


    draw: function(ctx) {
      IconRenderer(ctx, this.options);
    }
});

},{"../markers/iconRenderer":17}],9:[function(require,module,exports){
L.dwratMarker = function (latlng, options) {
  var marker = new L.Marker(latlng, {
      icon: new L.Icon.Canvas(options),
      iconSize: new L.Point(options.width, options.height),
  });

  marker.setStyle = function(options) {
    var o = this.options.icon.options;

    $.extend(true, o, options);
    if( !this._icon ) return;

    var ctx = this._icon.getContext('2d');
    ctx.clearRect(0, 0, o.width, o.height);

    IconRenderer(ctx, o);
  }

  return marker;
};

},{}],10:[function(require,module,exports){
require('./canvas');
require('./dwrat');

},{"./canvas":8,"./dwrat":9}],11:[function(require,module,exports){
(function (global){
var DroughtIcon = require('../markers/droughtIcon');
var markerConfig = require('../markers/config');
var markers = markerConfig.defaults;
var map, datastore;

global.settings = {
  renderDemand : 'empty'
};

module.exports.init = function(config) {
  map = config.map;
  datastore = config.datastore;

  var demandSteps = [0, 1, 50, 100, 250];

  var options = $.extend(true, {}, markers.riparian.unallocated);
  options.sides = 0;
  var icon = new DroughtIcon(options);
  $('#legend-riparian').append($(icon.ele));


  options = $.extend(true, {}, markers.application.unallocated);
  options.sides = 3;
  options.rotate = 90;
  icon = new DroughtIcon(options);
  $('#legend-pre-appropriative').append($(icon.ele));

  icon = new DroughtIcon(markers.application.unallocated);
  $('#legend-post-appropriative').append($(icon.ele));

  var table = '<table style="text-align:center"><tr style="vertical-align: bottom">';
  var icons = [];
  for( var i = 0; i < demandSteps.length; i++ ) {
    table += '<td style="padding:4px"><div id="legend-demand-'+i+'"></div><div>'+
              (demandSteps[i] == 1 ? '<' : '') +
              (demandSteps[i] == 250 ? '>' : '') +
              demandSteps[i]+'</div></td>';


    if( demandSteps[i] === 0 ) {
      options = $.extend(true, {}, markers.application.unallocated);
      options = $.extend(true, options, markers.noDemand);
    } else {
      options = $.extend(true, {}, markers.application.unallocated);

      var size = Math.sqrt(demandSteps[i]) * 3;
      if( size > 50 ) size = 50;
      if( size < 7 ) size = 7;

      options.height = (size*2)+2;
      options.width = (size*2)+2;
    }

    icons.push(new DroughtIcon(options));
  }
  $('#legend-demand').html(table+'</tr></table>');

  for( i = 0; i < icons.length; i++ ) {
    $('#legend-demand-'+i).append($(icons[i].ele));
  }

  this.redrawPDemandLegend();

  // init toggle button

  $('#legendToggle').on('click', function(){
    if( this.hasAttribute('showing') ) {
      this.removeAttribute('showing');
      $('#legend').hide('slow');
      this.innerHTML = '<i class="fa fa-arrow-right"></i>';

    } else {
      this.setAttribute('showing', '');
      $('#legend').show('slow');
      this.innerHTML = '<i class="fa fa-arrow-down"></i>';
    }
  });

  $('#renderTypeFilled').on('click', onRenderTypeChange);
  $('#renderTypeEmpty').on('click', onRenderTypeChange);

  $('#showNoDemand').on('click', function(){
    map.geojson.clearLayer();
    var noDemand = !$(this).is(':checked');
    map.geojson.add(datastore.get(noDemand));
  });
};

function redrawPDemandLegend() {
  var percentSteps = [0, 25, 50, 75, 100], i;

  var table = '<table style="text-align:center"><tr style="vertical-align: bottom">';
  var icons = [];
	for( i = 0; i < percentSteps.length; i++ ) {
		table += '<td style="padding:8px"><div id="legend-precent-of-demand-'+i+'"></div><div>'+
					percentSteps[i]+'%</div></td>';

		var options = $.extend(true, {}, markers.application.unallocated);

    markerConfig.percentDemand(options, percentSteps[i] / 100);

		icons.push(new DroughtIcon(options));
	}
	$('#legend-precent-of-demand').html(table+'</tr></table>');

	for( i = 0; i < icons.length; i++ ) {
		$('#legend-precent-of-demand-'+i).append($(icons[i].ele));
	}
};
module.exports.redrawPDemandLegend = redrawPDemandLegend;

function onRenderTypeChange() {
  var settings = global.settings;
  var isFilledChecked = $('#renderTypeFilled').is(':checked');
  var newVal = isFilledChecked ? 'filled' : 'empty';

  if( settings.renderDemand == newVal ) return;
  settings.renderDemand = newVal;

  // render legend
  redrawPDemandLegend();

  if( !currentPoints ) return;

  map.geojson.clearLayer();
  var noDemand = !$(this).is(':checked');
  map.geojson.add(datastore.get(noDemand));
}

function stamp(data) {
  var template = markerTemplate;
  for( var key in data ) template = template.replace('{{'+key+'}}', data[key]);
  return template;
}

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})

},{"../markers/config":15,"../markers/droughtIcon":16}],12:[function(require,module,exports){
var files = [];

var root = 'https://docs.google.com/spreadsheets/d/1ACi7P0pOy-JRjtw6HribQphhEOZ-0-CkQ_mqnyCfJcI/gviz/tq';

function init(resp) {
  var query = new google.visualization.Query(root);
  query.send(onInitLoad);
}

function onInitLoad(resp) {
  if (resp.isError()) {
    alert('Error in loading public data: ' + response.getMessage() + ' ' + response.getDetailedMessage());
    return;
  }

  var data = resp.getDataTable();
  var rowLen = data.getNumberOfRows();
  var colLen = data.getNumberOfColumns();


  for( var i = 0; i < rowLen; i++ ) {
    var file = {};
    for( var j = 0; j < colLen; j++ ) {
      file[data.getColumnId(j)] = data.getValue(i, j);
    }
    files.push(file);
  }

  console.log(files);
}

module.exports = {
  init : init
};

},{}],13:[function(require,module,exports){
var markerConfig = require('../markers/config');
var markers = markerConfig.defaults;

var geoJsonLayer;
var map, huc, datastore;

module.exports.init = function(config) {
  map = config.map.getLeaflet();
  datastore = config.datastore;
  huc = config.huc;
};

module.exports.add = function(points) {
  var showNoDemand = $('#showNoDemand').is(':checked');
  datastore.clearFeatures();

  if( !showNoDemand ) {
    tmp = [];
    for( var i = points.length-1; i >= 0; i-- ) {
      if( points[i].properties.allocations && points[i].properties.allocations.length > 0 ) {

        var demand = points[i].properties.allocations[0].demand;
        if( demand !== 0 ) tmp.push(points[i]);
      }
    }
    points = tmp;
  }

  geoJsonLayer = L.geoJson(points,{
    pointToLayer: function (feature, latlng) {
      var type = feature.properties.riparian ? 'riparian' : 'application';
      var allocation = 'unallocated';

      for( var i = 0; i < feature.properties.allocations.length; i++ ) {
        if( feature.properties.allocations[i].allocation > 0 ) allocation = 'allocated';
      }


      var options = $.extend(true, {}, markers[type][allocation]);

      if( feature.properties.allocations && feature.properties.allocations.length > 0 ) {

        var demand = feature.properties.allocations[0].demand;
        var allocation = feature.properties.allocations[0].allocation;

        if( demand === 0 ) {

          $.extend(true, options, markers.noDemand);
          feature.properties.noDemand = true;

        } else {
          markerConfig.percentDemand(options, allocation / demand);

          var size = Math.sqrt(demand) * 3;
          if( size > 50 ) size = 50;
          if( size < 7 ) size = 7;

          options.height = size*2;
          options.width = size*2;
        }
      }



      var marker;
      var d;
      try {
        d = feature.properties.priority_date ? parseInt(feature.properties.priority_date.replace(/-.*/,'')) : 2000;
      } catch(e) {
        d = 2000;
      }

      if( feature.properties.riparian ) {
        options.sides = 0;
        marker = L.dwratMarker(latlng, options);
      } else if ( d < 1914 ) {
        options.sides = 3;
        options.rotate = 90;
        marker = L.dwratMarker(latlng, options);
      } else {
        marker = L.dwratMarker(latlng, options);
      }

      datastore.addFeature({
        feature : feature,
        marker  : marker
      });
      return marker;
    }
  }).addTo(map);

  geoJsonLayer.on('click', function(e) {
    $('.select-text').remove();
    $('#info').show();
    var props = e.layer.feature.properties;

    select(e.layer);

    var ll = e.layer.feature.geometry.coordinates;

    var t, html = '';
    var allData = datastore.getFeatures();
    for( var i = 0; i < allData.length; i++ ) {
      t = allData[i].feature.geometry.coordinates;
      if( ll[0].toFixed(4) == t[0].toFixed(4) && ll[1].toFixed(4) == t[1].toFixed(4) ) {
        var p = allData[i].feature.properties;

        html += stamp({
          application_number : p.application_number,
          date : p.allocations[0].date,
          allocation : p.allocations[0].allocation,
          demand : p.allocations[0].demand,
          ratio : p.allocations[0].ratio !== null ? (p.allocations[0].ratio*100).toFixed(2) : '100',
          water_right_type : p['Right Type'],
          priority_date : p.priority_date ? p.priority_date : 'Unknown'
        });
      }
    }


    $('#info-result').html(html);
    $('#info').animate({
      scrollTop: $('.info-box').height()
    }, 300);
  });

  currentPoints = points;

  huc.render(points);
};

module.exports.clearLayer = function() {
  if( geoJsonLayer ) map.removeLayer(geoJsonLayer);
};

},{"../markers/config":15}],14:[function(require,module,exports){
var map;
var baseMaps = {};
var overlayMaps = {};

var geojson = require('./geojson');
var geojsonLayer = {};

var currentPoints = null;
var currentGeojson = null;

module.exports.legend = require('../legend');
module.exports.geojson = require('./geojson');



module.exports.init = function(options) {
  map = L.map('map',{trackResize:true});

  // add an OpenStreetMap tile layer
  L.tileLayer('http://{s}.tile.osm.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="http://osm.org/copyright">OpenStreetMap</a> contributors'
  }).addTo(map);

  var wms1 = L.tileLayer.wms("https://mapsengine.google.com/15542600734275549444-11853667273131550346-4/wms/?version=1.3.0", {
      layers: '15542600734275549444-08112974690991164587-4',
      format: 'image/png',
      transparent: true,
      attribution: "",
      bounds : L.latLngBounds(
        L.latLng(42.00943198804058, -114.1307597213407),
        L.latLng(32.53426345367493, -124.40971171678298)
      )
  }).addTo(map);

  var wms2 = L.tileLayer.wms("https://mapsengine.google.com/15542600734275549444-11853667273131550346-4/wms/?version=1.3.0", {
      layers: '15542600734275549444-16143158689603361093-4',
      format: 'image/png',
      transparent: true,
      attribution: "",
      bounds : L.latLngBounds(
        L.latLng(42.00943198804058, -114.1307597213407),
        L.latLng(32.53426345367493, -124.40971171678298)
      )
  });

  baseMaps = {};
  overlayMaps = {
    'Watersheds': wms1,
    'HUC 12': wms2
  };

  L.control.layers(baseMaps, overlayMaps, {position: 'bottomleft'}).addTo(map);

  options.map = this;
  geojson.init(options);
  this.legend.init(options);
};

module.exports.clearGeojsonLayer = function() {
  geojson.clearLayer();
};
module.exports.getLeaflet = function() {
  return map;
};

},{"../legend":11,"./geojson":13}],15:[function(require,module,exports){
(function (global){
var markers = {
  riparian : {
    allocated : {
      fillColor   : "#2525C9",
      color       : "#333333",
      weight      : 1,
      opacity     : 1,
      fillOpacity : 0.3,
			sides : 3,
			rotate : 90,
      width: 20,
      height: 20
    },
    unallocated : {
      fillColor   : "#ffffff",
      color       : "#333333",
      weight      : 1,
      opacity     : 1,
      fillOpacity : 0.3,
			sides : 3,
			rotate : 90,
      width: 20,
      height: 20
    }
  },
  application : {
    allocated : {
      fillColor   : "#2525C9",
      color       : "#333333",
      weight      : 1,
      opacity     : 1,
      fillOpacity : 0.3,
      sides       : 4,
      rotate      : 45,
      width: 20,
      height: 20
    },
    unallocated : {
      fillColor   : "#ffffff",
      color       : "#333333",
      weight      : 1,
      opacity     : 1,
      fillOpacity : 0.3,
      sides       : 4,
      rotate      : 45,
      width: 20,
      height: 20
    }
  },
  noDemand : {
    noFill : true,
    //sides : 0,
    color : "#333333",
    strikethrough : true,
    radius : 5,
    height : 12,
    width : 12
  }
};
module.exports.defaults = markers;

module.exports.percentDemand = function(options, percent, noDemand) {
  if( noDemand ) {
     $.extend(true, options, markers.noDemand);
     return;
  }

  var o;

  if( global.settings.renderDemand == 'filled' ) {

    if( percent <= 0 ) {
      options.fillColor = '#333';
      options.fillOpacity = 0.3;
    } else {
      o = percent;
      if( o > 1 ) o = 1;
      options.fillOpacity = o;
      options.fillColor = '#0000ff';
    }

  } else {

    if( percent >= 1 ) {
      options.fillColor = '#333';
      options.fillOpacity = 0.3;
    } else {
      o = 1 - percent;
      if( o > 1 ) o = 1;
      if( o < 0 ) o = 0;

      options.fillOpacity = o;
      options.fillColor = '#ff0000';
    }

  }
  //options.fillColor = '#'+getColor(allocation / demand);
};

module.exports.percentDemandHuc = function(percent) {
  if( percent == -1 ) {
     return {
       fillColor : '#ffffff',
       fillOpacity : 0.2,
       weight : 1,
       color: '#333333'
     };
  }


  if( global.settings.renderDemand == 'filled' ) {

    if( percent <= 0 ) {

      return {
        fillColor : '#333333',
        fillOpacity : 0.3,
        weight : 2,
        color: '#333333'
      };


    } else {
      var o = percent;
      if( o > 0.8 ) o = 0.8;

      return {
        fillColor : '#0000ff',
        fillOpacity : o,
        weight : 2,
        color: '#333333'
      };
    }

  } else {

    if( percent >= 1 ) {

      return {
        fillColor : '#333333',
        fillOpacity : 0.3,
        weight : 2,
        color: '#333333'
      };

    } else {
      var o = 1 - percent;
      if( o > 0.8 ) o = 0.8;
      if( o < 0 ) o = 0;

      return {
        fillColor : '#ff0000',
        fillOpacity : o,
        weight : 2,
        color: '#333333'
      };

    }

  }
  //options.fillColor = '#'+getColor(allocation / demand);
};

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})

},{}],16:[function(require,module,exports){
var IconRenderer = require('./iconRenderer');

module.exports = function(config) {
  this.config = config;
  this.ele = document.createElement('canvas');

  this.redraw = function() {
    var w = config.height || 32;
    var h = config.width || 32;

    this.ele.height = h;
    this.ele.width = w;

    var ctx = this.ele.getContext("2d");
    ctx.clearRect(0, 0, w, h);

    IconRenderer(ctx, config);
  };

  this.redraw();
};

},{"./iconRenderer":17}],17:[function(require,module,exports){
var util = require('./utils');

module.exports = function(ctx, config) {

  var sides = config.sides !== null ? config.sides : 6;
  var rotate = config.rotate ? config.rotate : 0;
  var x = config.width / 2;
  var y = config.height / 2;

  var a = ((Math.PI * 2) / config.sides);
  var r = rotate * (Math.PI / 180);

  var radius = (config.width / 2) - 1;

  var fillStyle = util.hexToRgb(config.fillColor);
  fillStyle.push(config.fillOpacity);
  ctx.fillStyle = 'rgba('+fillStyle.join(',')+')';

  ctx.strokeStyle = config.color;

  // think you need to adjust by x, y
  ctx.beginPath();

  // draw circle
  if ( sides < 3 ) {

    ctx.arc(x, y, radius, 0, 2*Math.PI);

  } else {

    var tx, ty, i;
    for (i = 0; i < config.sides; i++) {
      tx = x + (radius * Math.cos(a*i-r));
      ty = y + (radius * Math.sin(a*i-r));

      if( i === 0 ) ctx.moveTo(tx, ty);
      else ctx.lineTo(tx, ty);
    }
    ctx.lineTo(x + (radius * Math.cos(-1 * r)), y + (radius * Math.sin(-1 * r)));
  }

  if( !config.noFill ) ctx.fill();
  ctx.stroke();

  if( config.strikethrough ) {
    ctx.beginPath();
    ctx.moveTo(1,1);
    ctx.lineTo((x*2) - 1, (y*2) - 1);
    ctx.stroke();
  }
}

},{"./utils":18}],18:[function(require,module,exports){
module.exports.hexToRgb = function(hex) {
    var result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? [
        parseInt(result[1], 16),
        parseInt(result[2], 16),
        parseInt(result[3], 16)
    ] : [0,0,0];
};

module.exports.getColor = function(num) {
  if( num > 1 ) num = 1;
  if( num < 0 ) num = 0;

  var spread = Math.floor(510*num) - 255;

  if( spread < 0 ) return "ff00"+toHex(255+spread);
  else if( spread > 0 ) return toHex(255-spread)+"00ff";
  else return "ffff00";
};

module.exports.toHex = function(num) {
  num = num.toString(16);
  if( num.length == 1 ) num = "0"+num;
  return num;
};

},{}]},{},[7])(7)
});
//# sourceMappingURL=data:application/json;charset:utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9ncnVudC1icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJsaWIvc2hhcmVkL2RhdGFzdG9yZS9pbmRleC5qcyIsImxpYi9zaGFyZWQvZmlsZS9pbmRleC5qcyIsImxpYi9zaGFyZWQvZmlsZS9wYXJzZS5qcyIsImxpYi9zaGFyZWQvZmlsZS9wcm9jZXNzLmpzIiwibGliL3NoYXJlZC9maWxlL3NldHVwLmpzIiwibGliL3NoYXJlZC9odWMvaW5kZXguanMiLCJsaWIvc2hhcmVkL2luZGV4LmpzIiwibGliL3NoYXJlZC9sZWFmbGV0L2NhbnZhcy5qcyIsImxpYi9zaGFyZWQvbGVhZmxldC9kd3JhdC5qcyIsImxpYi9zaGFyZWQvbGVhZmxldC9pbmRleC5qcyIsImxpYi9zaGFyZWQvbGVnZW5kL2luZGV4LmpzIiwibGliL3NoYXJlZC9saWJyYXJ5L2luZGV4LmpzIiwibGliL3NoYXJlZC9tYXAvZ2VvanNvbi5qcyIsImxpYi9zaGFyZWQvbWFwL2luZGV4LmpzIiwibGliL3NoYXJlZC9tYXJrZXJzL2NvbmZpZy5qcyIsImxpYi9zaGFyZWQvbWFya2Vycy9kcm91Z2h0SWNvbi5qcyIsImxpYi9zaGFyZWQvbWFya2Vycy9pY29uUmVuZGVyZXIuanMiLCJsaWIvc2hhcmVkL21hcmtlcnMvdXRpbHMuanMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7QUNBQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNwQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN0S0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3BFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzdKQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3hDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzlJQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMvREE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ25DQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDcEJBO0FBQ0E7QUFDQTs7O0FDRkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOzs7O0FDdElBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDbENBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN0SUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7O0FDaEVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOzs7O0FDbEtBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3JCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNuREE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSIsImZpbGUiOiJnZW5lcmF0ZWQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlc0NvbnRlbnQiOlsiKGZ1bmN0aW9uIGUodCxuLHIpe2Z1bmN0aW9uIHMobyx1KXtpZighbltvXSl7aWYoIXRbb10pe3ZhciBhPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7aWYoIXUmJmEpcmV0dXJuIGEobywhMCk7aWYoaSlyZXR1cm4gaShvLCEwKTt2YXIgZj1uZXcgRXJyb3IoXCJDYW5ub3QgZmluZCBtb2R1bGUgJ1wiK28rXCInXCIpO3Rocm93IGYuY29kZT1cIk1PRFVMRV9OT1RfRk9VTkRcIixmfXZhciBsPW5bb109e2V4cG9ydHM6e319O3Rbb11bMF0uY2FsbChsLmV4cG9ydHMsZnVuY3Rpb24oZSl7dmFyIG49dFtvXVsxXVtlXTtyZXR1cm4gcyhuP246ZSl9LGwsbC5leHBvcnRzLGUsdCxuLHIpfXJldHVybiBuW29dLmV4cG9ydHN9dmFyIGk9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtmb3IodmFyIG89MDtvPHIubGVuZ3RoO28rKylzKHJbb10pO3JldHVybiBzfSkiLCJ2YXIgZGF0YSA9IHtcbiAgYWxsIDogW10sXG4gIG5vRGVtYW5kIDogW10sXG4gIGZlYXR1cmVzIDogW11cbn07XG5cbm1vZHVsZS5leHBvcnRzLnNldCA9IGZ1bmN0aW9uKHBvaW50cykge1xuICBkYXRhLmFsbCA9IHBvaW50cztcblxuICB0bXAgPSBbXTtcbiAgZm9yKCB2YXIgaSA9IHBvaW50cy5sZW5ndGgtMTsgaSA+PSAwOyBpLS0gKSB7XG4gICAgaWYoIHBvaW50c1tpXS5wcm9wZXJ0aWVzLmFsbG9jYXRpb25zICYmIHBvaW50c1tpXS5wcm9wZXJ0aWVzLmFsbG9jYXRpb25zLmxlbmd0aCA+IDAgKSB7XG5cbiAgICAgIHZhciBkZW1hbmQgPSBwb2ludHNbaV0ucHJvcGVydGllcy5hbGxvY2F0aW9uc1swXS5kZW1hbmQ7XG4gICAgICBpZiggZGVtYW5kICE9PSAwICkgdG1wLnB1c2gocG9pbnRzW2ldKTtcbiAgICB9XG4gIH1cbiAgZGF0YS5ub0RlbWFuZCA9IHRtcDtcbn07XG5cbm1vZHVsZS5leHBvcnRzLmdldCA9IGZ1bmN0aW9uKG5vRGVtYW5kKSB7XG4gIGlmKCBub0RlbWFuZCApIHJldHVybiBkYXRhLm5vRGVtYW5kO1xuICByZXR1cm4gZGF0YS5hbGw7XG59O1xuXG5tb2R1bGUuZXhwb3J0cy5jbGVhckZlYXR1cmVzID0gZnVuY3Rpb24oKXtcbiAgZGF0YS5mZWF0dXJlcyA9IFtdO1xufTtcblxubW9kdWxlLmV4cG9ydHMuYWRkRmVhdHVyZSA9IGZ1bmN0aW9uKGZlYXR1cmUpIHtcbiAgZGF0YS5mZWF0dXJlcy5wdXNoKGZlYXR1cmUpO1xufTtcblxubW9kdWxlLmV4cG9ydHMuZ2V0RmVhdHVyZXMgPSBmdW5jdGlvbigpIHtcbiAgcmV0dXJuIGRhdGEuZmVhdHVyZXM7XG59O1xuIiwidmFyIHByb2Nlc3MgPSByZXF1aXJlKCcuL3Byb2Nlc3MnKTtcblxudmFyIEhFQURFUlMgPSB7XG4gICAgYXBwbGljYXRpb25fbnVtYmVyIDoge1xuICAgICAgICByZXF1aXJlZCA6IHRydWUsXG4gICAgICAgIHR5cGUgOiAnc3RyaW5nJ1xuICAgIH0sXG4gICAgZGVtYW5kX2RhdGUgOiB7XG4gICAgICAgIHJlcXVpcmVkIDogdHJ1ZSxcbiAgICAgICAgdHlwZSA6ICdkYXRlLXN0cmluZydcbiAgICB9LFxuICAgIHdhdGVyc2hlZCA6IHtcbiAgICAgICAgcmVxdWlyZWQgOiBmYWxzZSxcbiAgICAgICAgdHlwZSA6ICdzdHJpbmcnXG4gICAgfSxcbiAgICBzZWFzb24gOiB7XG4gICAgICAgIHJlcXVpcmVkIDogZmFsc2UsXG4gICAgICAgIHR5cGUgOiAnYm9vbGVhbicsXG4gICAgfSxcbiAgICAnaHVjLTEyJyA6IHtcbiAgICAgICAgcmVxdWlyZWQgOiBmYWxzZSxcbiAgICAgICAgdHlwZSA6ICdib29sZWFuJ1xuICAgIH0sXG4gICAgd2F0ZXJfcmlnaHRfdHlwZSA6IHtcbiAgICAgICAgcmVxdWlyZWQgOiBmYWxzZSxcbiAgICAgICAgdHlwZSA6ICdzdHJpbmcnXG4gICAgfSxcbiAgICBwcmlvcml0eV9kYXRlIDoge1xuICAgICAgICByZXF1aXJlZCA6IHRydWUsXG4gICAgICAgIHR5cGUgOiAnZGF0ZS1zdHJpbmcnXG4gICAgfSxcbiAgICByaXBhcmlhbiA6IHtcbiAgICAgICAgcmVxdWlyZWQgOiBmYWxzZSxcbiAgICAgICAgdHlwZSA6ICdib29sZWFuJ1xuICAgIH0sXG4gICAgcHJlMTkxNCA6IHtcbiAgICAgICAgcmVxdWlyZWQgOiBmYWxzZSxcbiAgICAgICAgdHlwZSA6ICdib29sZWFuJ1xuICAgIH0sXG4gICAgZGVtYW5kIDoge1xuICAgICAgICByZXF1aXJlZCA6IHRydWUsXG4gICAgICAgIHR5cGUgOiAnZmxvYXQnXG4gICAgfSxcbiAgICBhbGxvY2F0aW9uIDoge1xuICAgICAgICByZXF1aXJlZCA6IHRydWUsXG4gICAgICAgIHR5cGUgOiAnZmxvYXQnXG4gICAgfVxufTtcblxudmFyIGxvY2F0aW9ucyA9IHt9LCBtYXAsIGRhdGFzdG9yZTtcblxuXG5mdW5jdGlvbiBjcmVhdGVHZW9Kc29uKGRhdGEsIGF0dHJNYXAsIGNhbGxiYWNrKSB7XG4gICAgLy8gZmlyc3QgbG9jYXRlIGRhdGFcbiAgICAkKCcjZmlsZS1sb2NhdGUnKS5odG1sKCdMb2NhdGluZyBkYXRhLi4uJyk7XG5cbiAgICB2YXIgaWRzID0gW10sIGtleTtcbiAgICB2YXIgY29sID0gZ2V0QXR0ckNvbCgnYXBwbGljYXRpb25fbnVtYmVyJywgZGF0YSwgYXR0ck1hcCk7XG4gICAgZm9yKCB2YXIgaSA9IDE7IGkgPCBkYXRhLmxlbmd0aDsgaSsrICkge1xuICAgICAgICB2YXIgaWQgPSBkYXRhW2ldW2NvbF07XG4gICAgICAgIGlmKCAhbG9jYXRpb25zW2lkXSApIGlkcy5wdXNoKGRhdGFbaV1bY29sXSk7XG4gICAgfVxuXG4gICAgbG9jYXRlRGF0YSgwLCBpZHMsIGZ1bmN0aW9uKCl7XG5cbiAgICAgICAgJCgnI2ZpbGUtbG9jYXRlJykuaHRtbCgnQ3JlYXRpbmcgZGF0YS4uLicpO1xuXG4gICAgICAgIHZhciBpTWFwID0ge307XG4gICAgICAgIGZvcigga2V5IGluIGF0dHJNYXAgKSBpTWFwW2F0dHJNYXBba2V5XV0gPSBrZXk7XG5cbiAgICAgICAgdmFyIGdlb0pzb24gPSBbXTtcbiAgICAgICAgZm9yKCB2YXIgaSA9IDE7IGkgPCBkYXRhLmxlbmd0aDsgaSsrICkge1xuICAgICAgICAgICAgaWYoICFsb2NhdGlvbnNbZGF0YVtpXVtjb2xdXSApIGNvbnRpbnVlO1xuXG4gICAgICAgICAgICB2YXIgcCA9IHtcbiAgICAgICAgICAgICAgICB0eXBlIDogJ0ZlYXR1cmUnLFxuICAgICAgICAgICAgICAgIGdlb21ldHJ5IDogJC5leHRlbmQoe30sIHRydWUsIGxvY2F0aW9uc1tkYXRhW2ldW2NvbF1dKSxcbiAgICAgICAgICAgICAgICBwcm9wZXJ0aWVzIDoge31cbiAgICAgICAgICAgIH07XG5cbiAgICAgICAgICAgIGZvciggdmFyIGogPSAwOyBqIDwgZGF0YVswXS5sZW5ndGg7IGorKyApIHtcbiAgICAgICAgICAgICAgICBrZXkgPSBkYXRhWzBdW2pdO1xuICAgICAgICAgICAgICAgIGlmKCBpTWFwW2tleV0gKSBrZXkgPSBpTWFwW2tleV07XG4gICAgICAgICAgICAgICAgcC5wcm9wZXJ0aWVzW2tleV0gPSAoSEVBREVSU1trZXldICYmIEhFQURFUlNba2V5XS50eXBlID09ICdmbG9hdCcpID8gcGFyc2VGbG9hdChkYXRhW2ldW2pdKSA6IGRhdGFbaV1bal07XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHAucHJvcGVydGllcy5hbGxvY2F0aW9ucyA9IFt7XG4gICAgICAgICAgICAgICAgc2Vhc29uIDogdHJ1ZSxcbiAgICAgICAgICAgICAgICBhbGxvY2F0aW9uIDogcC5wcm9wZXJ0aWVzLmFsbG9jYXRpb24sXG4gICAgICAgICAgICAgICAgZGVtYW5kIDogcC5wcm9wZXJ0aWVzLmRlbWFuZCxcbiAgICAgICAgICAgICAgICBmb3JlY2FzdCA6IGZhbHNlLFxuICAgICAgICAgICAgICAgIGRhdGUgOiBwLnByb3BlcnRpZXMuZGVtYW5kX2RhdGUsXG4gICAgICAgICAgICAgICAgcHVibGljX2hlYWx0aF9iaW5kIDogZmFsc2UsXG4gICAgICAgICAgICAgICAgd3JiaW5kIDogZmFsc2UsXG4gICAgICAgICAgICAgICAgcmF0aW8gOiAocC5wcm9wZXJ0aWVzLmRlbWFuZCA+IDApID8gKHAucHJvcGVydGllcy5hbGxvY2F0aW9uIC8gcC5wcm9wZXJ0aWVzLmRlbWFuZCkgOiAwXG4gICAgICAgICAgICB9XTtcblxuICAgICAgICAgICAgZ2VvSnNvbi5wdXNoKHApO1xuICAgICAgICB9XG5cbiAgICAgICAgbWFwLmNsZWFyR2VvanNvbkxheWVyKCk7XG4gICAgICAgIGRhdGFzdG9yZS5zZXQoZ2VvSnNvbik7XG4gICAgICAgIG1hcC5nZW9qc29uLmFkZChnZW9Kc29uKTtcblxuICAgICAgICAkKCcjZmlsZS1sb2NhdGUnKS5odG1sKCcnKTtcbiAgICAgICAgY2FsbGJhY2soKTtcbiAgICB9KTtcbn1cblxuZnVuY3Rpb24gZ2V0QXR0ckNvbChhdHRyLCBkYXRhLCBtYXApIHtcbiAgICBpZiggbWFwW2F0dHJdICkgcmV0dXJuIGRhdGFbMF0uaW5kZXhPZihtYXBbYXR0cl0pO1xuICAgIHJldHVybiBkYXRhWzBdLmluZGV4T2YoYXR0cik7XG59XG5cbmZ1bmN0aW9uIGxvY2F0ZURhdGEoaW5kZXgsIGlkcywgY2FsbGJhY2spIHtcbiAgICBpZiggaW5kZXgrMSA+PSBpZHMubGVuZ3RoICkge1xuICAgICAgICBjYWxsYmFjaygpO1xuICAgIH0gZWxzZSB7XG4gICAgICAgIHZhciBpZEdyb3VwID0gW107XG5cbiAgICAgICAgdmFyIGkgPSAwO1xuICAgICAgICBmb3IoIGkgPSBpbmRleDsgaSA8IGluZGV4KzIwMDsgaSsrICkge1xuICAgICAgICAgICAgaWYoIGlkcy5sZW5ndGggPT0gaSApIGJyZWFrO1xuICAgICAgICAgICAgaWRHcm91cC5wdXNoKGlkc1tpXSk7XG4gICAgICAgIH1cbiAgICAgICAgaW5kZXggKz0gMjAwO1xuICAgICAgICBjb25zb2xlLmxvZyhpbmRleCk7XG5cblxuXG4gICAgICAgIHZhciBxdWVyeSA9IG5ldyBnb29nbGUudmlzdWFsaXphdGlvbi5RdWVyeSgnaHR0cDovL3dhdGVyc2hlZC5pY2UudWNkYXZpcy5lZHUvdml6c291cmNlL3Jlc3Q/dmlldz1sb2NhdGUoXFwnJytcbiAgICAgICAgICAgIGlkR3JvdXAuam9pbignLCcpKydcXCcpJnRxPVNFTEVDVCAqJyk7XG4gICAgICAgIHF1ZXJ5LnNlbmQoZnVuY3Rpb24ocmVzcCl7XG4gICAgICAgICAgICBpZiggcmVzcC5pc0Vycm9yKCkgKSB7XG4gICAgICAgICAgICAgICAgY29uc29sZS5sb2cocmVzcC5nZXRNZXNzYWdlKCkpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICB2YXIgZHQgPSByZXNwLmdldERhdGFUYWJsZSgpO1xuICAgICAgICAgICAgICAgIGZvciggdmFyIGkgPSAwOyBpIDwgZHQuZ2V0TnVtYmVyT2ZSb3dzKCk7IGkrKyApIHtcbiAgICAgICAgICAgICAgICAgICAgbG9jYXRpb25zW2R0LmdldFZhbHVlKGksIDApXSA9IEpTT04ucGFyc2UoZHQuZ2V0VmFsdWUoaSwgMikpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgJCgnI2ZpbGUtbG9jYXRlJykuaHRtbCgnTG9jYXRpbmcgZGF0YSAnKygoaW5kZXgvaWRzLmxlbmd0aCkudG9GaXhlZCgyKSoxMDApKyclLi4uJyk7XG4gICAgICAgICAgICBsb2NhdGVEYXRhKGluZGV4LCBpZHMsIGNhbGxiYWNrKTtcbiAgICAgICAgfSk7XG4gICAgfVxufVxuXG5cblxudmFyIGZpbGUgPSB7XG4gIEhFQURFUlMgOiBIRUFERVJTLFxuICBpbml0IDogZnVuY3Rpb24ob3B0aW9ucyl7XG4gICAgbWFwID0gb3B0aW9ucy5tYXA7XG4gICAgZGF0YXN0b3JlID0gb3B0aW9ucy5kYXRhc3RvcmU7XG4gICAgb3B0aW9ucy5maWxlID0gdGhpcztcblxuICAgIHJlcXVpcmUoJy4vc2V0dXAnKShwcm9jZXNzKTtcbiAgICBwcm9jZXNzLmluaXQob3B0aW9ucyk7XG4gIH0sXG4gIGNyZWF0ZUdlb0pzb24gOiBjcmVhdGVHZW9Kc29uLFxuICBwcm9jZXNzIDogcHJvY2Vzc1xufTtcblxuXG5tb2R1bGUuZXhwb3J0cyA9IGZpbGU7XG4iLCJtb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uKHR5cGUsIGNvbnRlbnRzLCBjYWxsYmFjaykge1xuICAgIGlmKCB0eXBlID09ICd4bHN4JyApIHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGZ1bmN0aW9uIG9uWGxzeENvbXBsZXRlKHdiKXtcbiAgICAgICAgICAgICAgICBzZWxlY3RXb3Jrc2hlZXQod2IuU2hlZXROYW1lcywgZnVuY3Rpb24oc2hlZXROYW1lKXtcbiAgICAgICAgICAgICAgICAgICAgdmFyIGNzdiA9IFhMU1gudXRpbHMuc2hlZXRfdG9fY3N2KHdiLlNoZWV0c1tzaGVldE5hbWVdKTtcbiAgICAgICAgICAgICAgICAgICAgJC5jc3YudG9BcnJheXMoY3N2LCB7fSwgZnVuY3Rpb24oZXJyLCBkYXRhKXtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmKCBlcnIgKSByZXR1cm4gY2FsbGJhY2soZXJyKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNhbGxiYWNrKG51bGwsIGRhdGEpO1xuICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgdmFyIHdvcmtlciA9IG5ldyBXb3JrZXIoJ2Jvd2VyX2NvbXBvbmVudHMvanMteGxzeC94bHN4d29ya2VyLmpzJyk7XG4gICAgICAgICAgICB3b3JrZXIub25tZXNzYWdlID0gZnVuY3Rpb24oZSkge1xuICAgICAgICAgICAgICAgIHN3aXRjaChlLmRhdGEudCkge1xuICAgICAgICAgICAgICAgICAgICBjYXNlICdyZWFkeSc6IGJyZWFrO1xuICAgICAgICAgICAgICAgICAgICBjYXNlICdlJzogY29uc29sZS5lcnJvcihlLmRhdGEuZCk7IGJyZWFrO1xuICAgICAgICAgICAgICAgICAgICBjYXNlICd4bHN4Jzogb25YbHN4Q29tcGxldGUoSlNPTi5wYXJzZShlLmRhdGEuZCkpOyBicmVhaztcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9O1xuICAgICAgICAgICAgd29ya2VyLnBvc3RNZXNzYWdlKHtkOmNvbnRlbnRzLGI6dHJ1ZX0pO1xuXG4gICAgICAgIH0gY2F0Y2goZSkge1xuICAgICAgICAgICAgY2FsbGJhY2soZSk7XG4gICAgICAgIH1cblxuICAgIH0gZWxzZSBpZiggaW5mby5leHQgPT0gJ3hscycgKSB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBmdW5jdGlvbiBvblhsc0NvbXBsZXRlKHdiKXtcbiAgICAgICAgICAgICAgICBzZWxlY3RXb3Jrc2hlZXQod2IuU2hlZXROYW1lcywgZnVuY3Rpb24oc2hlZXROYW1lKXtcbiAgICAgICAgICAgICAgICAgICAgdmFyIGNzdiA9IFhMUy51dGlscy5zaGVldF90b19jc3Yod2IuU2hlZXRzW3NoZWV0TmFtZV0pO1xuICAgICAgICAgICAgICAgICAgICAkLmNzdi50b0FycmF5cyhjc3YsIHt9LCBmdW5jdGlvbihlcnIsIGRhdGEpe1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYoIGVyciApIHJldHVybiBjYWxsYmFjayhlcnIpO1xuICAgICAgICAgICAgICAgICAgICAgICAgY2FsbGJhY2sobnVsbCwgZGF0YSk7XG4gICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICB2YXIgd29ya2VyID0gbmV3IFdvcmtlcignYm93ZXJfY29tcG9uZW50cy9qcy14bHMveGxzd29ya2VyLmpzJyk7XG4gICAgICAgICAgICB3b3JrZXIub25tZXNzYWdlID0gZnVuY3Rpb24oZSkge1xuICAgICAgICAgICAgICAgIHN3aXRjaChlLmRhdGEudCkge1xuICAgICAgICAgICAgICAgICAgICBjYXNlICdyZWFkeSc6IGJyZWFrO1xuICAgICAgICAgICAgICAgICAgICBjYXNlICdlJzogY29uc29sZS5lcnJvcihlLmRhdGEuZCk7IGJyZWFrO1xuICAgICAgICAgICAgICAgICAgICBjYXNlICd4bHN4Jzogb25YbHNDb21wbGV0ZShKU09OLnBhcnNlKGUuZGF0YS5kKSk7IGJyZWFrO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH07XG4gICAgICAgICAgICB3b3JrZXIucG9zdE1lc3NhZ2Uoe2Q6Y29udGVudHMsYjp0cnVlfSk7XG5cbiAgICAgICAgfSBjYXRjaChlKSB7XG4gICAgICAgICAgICBkZWJ1Z2dlcjtcbiAgICAgICAgICAgIHRoaXMub25Db21wbGV0ZShlLCBudWxsLCBpbmZvLCAxLCAxLCBhcnIsIGNhbGxiYWNrKTtcbiAgICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICB2YXIgb3B0aW9ucyA9IHt9O1xuICAgICAgICAgICAgLy9pZiggaW5mby5wYXJzZXIgPT0gJ2Nzdi10YWInICkgb3B0aW9ucy5zZXBhcmF0b3IgPSAnXFx0JztcblxuICAgICAgICAgICAgJC5jc3YudG9BcnJheXMoY29udGVudHMsIG9wdGlvbnMsIGZ1bmN0aW9uKGVyciwgZGF0YSl7XG4gICAgICAgICAgICAgICAgaWYoIGVyciApIHJldHVybiBjYWxsYmFjayhlcnIpO1xuICAgICAgICAgICAgICAgIGNhbGxiYWNrKG51bGwsIGRhdGEpO1xuICAgICAgICAgICAgfS5iaW5kKHRoaXMpKTtcbiAgICAgICAgfSBjYXRjaChlKSB7XG4gICAgICAgICAgICBkZWJ1Z2dlcjtcbiAgICAgICAgICAgIHRoaXMub25Db21wbGV0ZShlLCBudWxsLCBpbmZvLCAxLCAxLCBhcnIsIGNhbGxiYWNrKTtcbiAgICAgICAgfVxuICAgIH1cbn1cbiIsInZhciBwYXJzZSA9IHJlcXVpcmUoJy4vcGFyc2UnKTtcbnZhciBwcmV2aW91c0F0dHJNYXAgPSB7fTtcblxudmFyIGZpbGUsIG1hcCwgZmlsZW5hbWUgPSAnJywgaHVjO1xuXG5tb2R1bGUuZXhwb3J0cy5pbml0ID0gZnVuY3Rpb24ob3B0aW9ucykge1xuICBmaWxlID0gb3B0aW9ucy5maWxlO1xuICBtYXAgPSBvcHRpb25zLm1hcDtcbiAgaHVjID0gb3B0aW9ucy5odWM7XG59O1xuXG4vLyBwcm9jZXNzIGEgZmlsZVxubW9kdWxlLmV4cG9ydHMucnVuID0gZnVuY3Rpb24oZSkge1xuICBlLnN0b3BQcm9wYWdhdGlvbigpO1xuICBlLnByZXZlbnREZWZhdWx0KCk7XG4gIHZhciBmaWxlcyA9IGUuZGF0YVRyYW5zZmVyID8gZS5kYXRhVHJhbnNmZXIuZmlsZXMgOiBlLnRhcmdldC5maWxlczsgLy8gRmlsZUxpc3Qgb2JqZWN0LlxuXG4gIGlmKCBmaWxlcy5sZW5ndGggPiAwICkge1xuICAgICQoJyNmaWxlLWxvY2F0ZScpLmh0bWwoJ0xvYWRpbmcgZmlsZS4uLicpO1xuICAgIGZpbGVuYW1lID0gZmlsZXNbMF0ubmFtZTtcbiAgICByZWFkKGZpbGVzWzBdKTtcbiAgfVxufTtcblxubW9kdWxlLmV4cG9ydHMuc2V0RmlsZW5hbWUgPSBmdW5jdGlvbihuYW1lKSB7XG4gIGZpbGVuYW1lID0gbmFtZTtcbn07XG5cbmZ1bmN0aW9uIGltcG9ydENvbnRlbnRzKHR5cGUsIGNvbnRlbnRzLCBjYWxsYmFjaykge1xuICBwYXJzZSh0eXBlLCBjb250ZW50cywgb25GaWxlUGFyc2VkKTtcbn1cbm1vZHVsZS5leHBvcnRzLmltcG9ydENvbnRlbnRzID0gaW1wb3J0Q29udGVudHM7XG5cbmZ1bmN0aW9uIG9uRmlsZVBhcnNlZChlcnIsIGRhdGEpIHtcbiAgJCgnI2ZpbGUtbG9jYXRlJykuaHRtbCgnJyk7XG4gIG1hdGNoQ29scyhkYXRhLCBmdW5jdGlvbihjb2xNYXApe1xuXG4gICAgLy8gbm93IGxvY2F0ZSBkYXRhIGFuZCBjcmVhdGVcbiAgICBmaWxlLmNyZWF0ZUdlb0pzb24oZGF0YSwgY29sTWFwLCB1cGRhdGVVaVBvc3RJbXBvcnQpO1xuICB9KTtcbn1cblxuZnVuY3Rpb24gdXBkYXRlVWlQb3N0SW1wb3J0KCkge1xuICAkKCcjZGF0ZS1zZWxlY3Rpb24nKS5oaWRlKCk7XG4gICQoJyNmaWxlLXNlbGVjdGlvbicpLmh0bWwoZmlsZW5hbWUrJyA8YSBjbGFzcz1cImJ0biBidG4tZGVmYXVsdFwiIGlkPVwicmVtb3ZlLWZpbGUtYnRuXCI+PGkgY2xhc3M9XCJmYSBmYS10aW1lc1wiPjwvaT48L2E+Jyk7XG5cbiAgJCgnI3JlbW92ZS1maWxlLWJ0bicpLm9uKCdjbGljaycsZnVuY3Rpb24oKXtcbiAgICBtYXAuZ2VvanNvbi5jbGVhckxheWVyKCk7XG4gICAgaHVjLmNsZWFyKCk7XG4gICAgJCgnI2RhdGUtc2VsZWN0aW9uJykuc2hvdygpO1xuICAgICQoJyNmaWxlLXNlbGVjdGlvbicpLmh0bWwoJycpO1xuICB9KTtcblxuICAkKCcjZmlsZS1pbnB1dCcpLnZhbCgnJyk7XG4gICQoJyNmaWxlLW1vZGFsJykubW9kYWwoJ2hpZGUnKTtcbn1cblxuZnVuY3Rpb24gcmVhZChyYXcpIHtcbiAgICBfcmVzZXRVSSgpO1xuXG4gICAgdmFyIHR5cGUgPSAndGV4dCc7XG5cbiAgICB2YXIgcmVhZGVyID0gbmV3IEZpbGVSZWFkZXIoKTtcbiAgICByZWFkZXIub25sb2FkID0gZnVuY3Rpb24oZSkge1xuICAgICAgICBpbXBvcnRDb250ZW50cyh0eXBlLCBlLnRhcmdldC5yZXN1bHQpO1xuICAgIH07XG5cbiAgICBpZiggcmF3Lm5hbWUubWF0Y2goLy4qXFwueGxzeD8kLykgKSB7XG4gICAgICAgIHR5cGUgPSByYXcubmFtZS5yZXBsYWNlKC8uKlxcLi8sJycpO1xuICAgICAgICByZWFkZXIucmVhZEFzQmluYXJ5U3RyaW5nKHJhdyk7XG4gICAgfSBlbHNlIHtcbiAgICAgICAgcmVhZGVyLnJlYWRBc1RleHQocmF3KTtcbiAgICB9XG59XG5cbmZ1bmN0aW9uIG1hdGNoQ29scyhkYXRhLCBjYWxsYmFjaykge1xuICAgIGlmKCBkYXRhLmxlbmd0aCA9PSAwICkgcmV0dXJuIGFsZXJ0KCdZb3VyIGZpbGUgaXMgZW1wdHknKTtcblxuICAgIHZhciBtYXRjaGVzID0gW107XG4gICAgdmFyIHJlcXVpcmVkTWlzbWF0Y2hlcyA9IFtdO1xuICAgIHZhciBtYXBwZWQgPSBwcmV2aW91c0F0dHJNYXA7XG5cbiAgICB2YXIgZmxhdHRlbiA9IFtdO1xuICAgIGZvciggdmFyIGkgPSAwOyBpIDwgZGF0YVswXS5sZW5ndGg7IGkrKyApIHtcbiAgICAgIGZsYXR0ZW4ucHVzaChkYXRhWzBdW2ldLnRvTG93ZXJDYXNlKCkpO1xuICAgIH1cblxuICAgIGZvciggdmFyIGtleSBpbiBmaWxlLkhFQURFUlMgKSB7XG4gICAgICAgIGlmKCBwcmV2aW91c0F0dHJNYXBba2V5XSApIHtcbiAgICAgICAgICAgIG1hdGNoZXMucHVzaChrZXkpO1xuICAgICAgICB9IGVsc2UgaWYoIGZsYXR0ZW4uaW5kZXhPZihrZXkudG9Mb3dlckNhc2UoKSkgPT0gLTEgJiYgZmlsZS5IRUFERVJTW2tleV0ucmVxdWlyZWQgKSB7XG4gICAgICAgICAgICByZXF1aXJlZE1pc21hdGNoZXMucHVzaChrZXkpO1xuICAgICAgICB9IGVsc2UgaWYoIGZsYXR0ZW4uaW5kZXhPZihrZXkudG9Mb3dlckNhc2UoKSkgPiAtMSApIHtcbiAgICAgICAgICBpZiggZGF0YVswXS5pbmRleE9mKGtleSkgPiAtMSApIHtcbiAgICAgICAgICAgIG1hdGNoZXMucHVzaChrZXkpO1xuICAgICAgICAgIH0gZWxzZSB7IC8vIHRoZSBjYXNlIGRpZmZlcnMsIGFkZCBpdCB0byB0aGUgYXR0cmlidXRlIG1hcFxuICAgICAgICAgICAgdmFyIGluZGV4ID0gZmxhdHRlbi5pbmRleE9mKGtleS50b0xvd2VyQ2FzZSgpKTtcbiAgICAgICAgICAgIHByZXZpb3VzQXR0ck1hcFtrZXldID0gZGF0YVswXVtpbmRleF07XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgaWYoIHJlcXVpcmVkTWlzbWF0Y2hlcy5sZW5ndGggPT0gMCApIHJldHVybiBjYWxsYmFjayhwcmV2aW91c0F0dHJNYXApO1xuXG4gICAgdmFyIHRhYmxlID0gJzx0YWJsZSBjbGFzcz1cInRhYmxlXCI+JztcbiAgICBmb3IoIHZhciBpID0gMDsgaSA8IHJlcXVpcmVkTWlzbWF0Y2hlcy5sZW5ndGg7IGkrKyApIHtcbiAgICAgICAgdGFibGUgKz0gJzx0cj48dGQ+JytyZXF1aXJlZE1pc21hdGNoZXNbaV0rJzwvdGQ+PHRkPicrX2NyZWF0ZU1hdGNoU2VsZWN0b3IocmVxdWlyZWRNaXNtYXRjaGVzW2ldLCBkYXRhWzBdLCBtYXRjaGVzKSsnPC90ZD48L3RyPic7XG4gICAgfVxuICAgIHRhYmxlICs9ICc8L3RhYmxlPic7XG5cbiAgICAkKCcjbWF0Y2hUYWJsZScpLmh0bWwoJzxkaXYgc3R5bGU9XCJtYXJnaW4tdG9wOjIwcHg7Zm9udC13ZWlnaHQ6Ym9sZFwiPlBsZWFzZSBtYXRjaCB0aGUgZm9sbG93aW5nIHJlcXVpcmVkIGNvbHVtbnMgdG8gY29udGludWU8L2Rpdj4nK3RhYmxlKTtcbiAgICAkKCcubWF0Y2gtc2VsZWN0b3InKS5vbignY2hhbmdlJywgZnVuY3Rpb24oKXtcbiAgICAgICAgdmFyIGtleSA9ICQodGhpcykuYXR0cigna2V5Jyk7XG4gICAgICAgIHZhciB2YWwgPSAkKHRoaXMpLnZhbCgpO1xuXG4gICAgICAgIGlmKCB2YWwgPT0gJycgfHwgIXZhbCApIHtcbiAgICAgICAgICAgIGRlbGV0ZSBtYXBwZWRba2V5XTtcbiAgICAgICAgICAgIHJlcXVpcmVkTWlzbWF0Y2hlcy5wdXNoKGtleSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBtYXBwZWRba2V5XSA9IHZhbDtcbiAgICAgICAgICAgIHZhciBpbmRleCA9IHJlcXVpcmVkTWlzbWF0Y2hlcy5pbmRleE9mKGtleSk7XG4gICAgICAgICAgICBpZiAoaW5kZXggPiAtMSkgcmVxdWlyZWRNaXNtYXRjaGVzLnNwbGljZShpbmRleCwgMSk7XG4gICAgICAgIH1cblxuXG4gICAgICAgIGlmKCByZXF1aXJlZE1pc21hdGNoZXMubGVuZ3RoID09IDAgKSB7XG4gICAgICAgICAgICAkKCcjbWF0Y2hUYWJsZScpLmh0bWwoJycpO1xuICAgICAgICAgICAgcHJldmlvdXNBdHRyTWFwID0gbWFwcGVkO1xuICAgICAgICAgICAgY2FsbGJhY2sobWFwcGVkKTtcbiAgICAgICAgfVxuICAgIH0pO1xufVxuXG5cbmZ1bmN0aW9uIF9yZXNldFVJKCkge1xuICAgICQoJyNtYXRjaFRhYmxlJykuaHRtbCgnJyk7XG4gICAgJCgnI2ZpbGUtbG9jYXRlJykuaHRtbCgnJyk7XG59XG5cbmZ1bmN0aW9uIF9jcmVhdGVNYXRjaFNlbGVjdG9yKGtleSwgYXJyLCBtYXRjaGVzKSB7XG4gICAgdmFyIHNlbGVjdCA9ICc8c2VsZWN0IGNsYXNzPVwibWF0Y2gtc2VsZWN0b3JcIiBrZXk9XCInK2tleSsnXCI+PG9wdGlvbj48L29wdGlvbj4nO1xuXG4gICAgZm9yKCB2YXIgaSA9IDA7IGkgPCBhcnIubGVuZ3RoOyBpKysgKSB7XG4gICAgICAgIGlmKCBtYXRjaGVzLmluZGV4T2YoYXJyW2ldKSA+IC0xICkgY29udGludWU7XG4gICAgICAgIHNlbGVjdCArPSAnPG9wdGlvbiB2YWx1ZT1cIicrYXJyW2ldKydcIj4nK2FycltpXSsnPC9vcHRpb24+JztcbiAgICB9XG4gICAgcmV0dXJuIHNlbGVjdCArICc8L3NlbGVjdD4nO1xufVxuXG5mdW5jdGlvbiBzZWxlY3RXb3Jrc2hlZXQoc2hlZXROYW1lcywgY2FsbGJhY2spIHtcbiAgICBjb25zb2xlLmxvZyhzaGVldE5hbWVzKTtcblxuICAgIGlmKCBzaGVldE5hbWVzLmxlbmd0aCA9PSAxICkgY2FsbGJhY2soc2hlZXROYW1lc1swXSk7XG5cbiAgICAvLyBhZGQgVUkgaW50ZXJhY3Rpb24gaGVyZVxuICAgIGNhbGxiYWNrKHNoZWV0TmFtZXNbMF0pO1xufVxuIiwibW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbihwcm9jZXNzKSB7XG4gICQoJyNjbG9zZS1wb3B1cCcpLm9uKCdjbGljaycsIGZ1bmN0aW9uKCl7XG4gICAgJCgnI2luZm8nKS5yZW1vdmVDbGFzcygnZmFkZUluRG93bicpLmFkZENsYXNzKCdzbGlkZU91dFJpZ2h0Jyk7XG5cbiAgICBzZWxlY3QobnVsbCk7XG4gICAgc2V0VGltZW91dChmdW5jdGlvbigpe1xuICAgICAgJCgnI2luZm8nKS5oaWRlKCkuYWRkQ2xhc3MoJ2ZhZGVJbkRvd24nKS5yZW1vdmVDbGFzcygnc2xpZGVPdXRSaWdodCcpO1xuICAgIH0sIDgwMCk7XG4gIH0pO1xuXG4gIC8vIGZpbGUgdXBsb2FkIHN0dWZmXG4gICQoJyNmaWxlLW1vZGFsJykubW9kYWwoe3Nob3c6ZmFsc2V9KTtcbiAgJCgnI2ZpbGUtaW5wdXQnKS5vbignY2hhbmdlJywgZnVuY3Rpb24oZSkge1xuICAgIHByb2Nlc3MucnVuKGUpO1xuICB9KTtcbiAgJCgnI3VwbG9hZC1idG4nKS5vbignY2xpY2snLCBmdW5jdGlvbigpe1xuICAgICQoJyNmaWxlLW1vZGFsJykubW9kYWwoJ3Nob3cnKTtcbiAgfSk7XG5cbiAgJCgnYm9keScpLm9uKCdkcmFnb3ZlcicsIGZ1bmN0aW9uKGUpe1xuICAgIGUucHJldmVudERlZmF1bHQoKTtcbiAgICBlLnN0b3BQcm9wYWdhdGlvbigpO1xuXG4gICAgJCgnI3VwbG9hZC1kcm9wLW1lc3NhZ2UnKS5zaG93KCk7XG4gICAgJCgnI3dyYXBwZXInKS5jc3MoJ29wYWNpdHknLCAwLjMpO1xuICB9KS5vbignZHJhZ2xlYXZlJywgZnVuY3Rpb24oZSl7XG4gICAgZS5wcmV2ZW50RGVmYXVsdCgpO1xuICAgIGUuc3RvcFByb3BhZ2F0aW9uKCk7XG5cbiAgICAkKCcjdXBsb2FkLWRyb3AtbWVzc2FnZScpLmhpZGUoKTtcbiAgICAkKCcjd3JhcHBlcicpLmNzcygnb3BhY2l0eScsMSk7XG4gIH0pLm9uKCdkcm9wJywgZnVuY3Rpb24oZSl7XG4gICAgJCgnI3VwbG9hZC1kcm9wLW1lc3NhZ2UnKS5oaWRlKCk7XG4gICAgJCgnI3dyYXBwZXInKS5jc3MoJ29wYWNpdHknLDEpO1xuXG4gICAgcHJvY2Vzcy5ydW4oZS5vcmlnaW5hbEV2ZW50KTtcbiAgICAkKCcjZmlsZS1tb2RhbCcpLm1vZGFsKCdzaG93Jyk7XG5cbiAgfSk7XG59O1xuIiwidmFyIG1hcmtlckNvbmZpZyA9IHJlcXVpcmUoJy4uL21hcmtlcnMvY29uZmlnJyk7XG5cbnZhciBtYXA7XG52YXIgbGF5ZXJzID0gW107XG52YXIgcG9pbnRzQnlIdWMgPSB7fTtcbnZhciB1cmxQcmVmaXggPSAnaHR0cDovL3dhdGVyc2hlZC5pY2UudWNkYXZpcy5lZHUvdml6c291cmNlL3Jlc3Q/dmlldz1nZXRfaHVjX2J5X2lkKFxcJyc7XG52YXIgdXJsUG9zdGl4ID0gJ1xcJykmdHE9U0VMRUNUIConO1xuXG52YXIgaHVjQ2FjaGUgPSB7fTtcbnZhciByZXF1ZXN0ZWQgPSB7fTtcblxudmFyIHNob3dpbmcgPSB0cnVlO1xudmFyIGN1cnJlbnRQb2ludHMgPSBudWxsO1xuXG5mdW5jdGlvbiBpbml0KG9wdGlvbnMpIHtcbiAgbWFwID0gb3B0aW9ucy5tYXAuZ2V0TGVhZmxldCgpO1xuXG4gICQoJyNyZW5kZXJIdWNBdmcnKS5vbignY2hhbmdlJywgZnVuY3Rpb24oKXtcbiAgICBzaG93aW5nID0gJCh0aGlzKS5pcygnOmNoZWNrZWQnKTtcbiAgICBvblZpc2liaWxpdHlVcGRhdGUoc2hvd2luZyk7XG4gIH0pO1xufVxuXG5mdW5jdGlvbiBvblZpc2liaWxpdHlVcGRhdGUoKSB7XG4gIGlmKCAhc2hvd2luZyApIHtcbiAgICBjbGVhcigpO1xuICB9IGVsc2UgaWYoIGN1cnJlbnRQb2ludHMgIT09IG51bGwgKXtcbiAgICByZW5kZXIoY3VycmVudFBvaW50cyk7XG4gIH1cbn1cblxuZnVuY3Rpb24gY2xlYXIoKSB7XG4gIC8vIGNsZWFyIGFsbCBsYXllcnNcbiAgZm9yKCB2YXIgaSA9IDA7IGkgPCBsYXllcnMubGVuZ3RoOyBpKysgKSB7XG4gICAgbWFwLnJlbW92ZUxheWVyKGxheWVyc1tpXSk7XG4gIH1cbiAgbGF5ZXJzID0gW107XG4gIHBvaW50c0J5SHVjID0ge307XG59XG5cbmZ1bmN0aW9uIHJlbmRlcihwb2ludHMpIHtcbiAgY3VycmVudFBvaW50cyA9IHBvaW50cztcbiAgaWYoICFzaG93aW5nICkgcmV0dXJuO1xuXG4gIGNsZWFyKCk7XG5cbiAgLy8gb3JnYW5pemUgcG9pbnRzIGJ5IGh1Y1xuICB2YXIgaHVjO1xuICBmb3IoIHZhciBpID0gMDsgaSA8IGN1cnJlbnRQb2ludHMubGVuZ3RoOyBpKysgKSB7XG4gICAgLy8gVE9ETzogZGlkIHF1aW5uIGNoYW5nZSB0aGlzP1xuICAgIGh1YyA9IHBvaW50c1tpXS5wcm9wZXJ0aWVzWydodWMtMTInXSB8fCBwb2ludHNbaV0ucHJvcGVydGllcy5odWNfMTI7XG5cbiAgICBpZiggcG9pbnRzQnlIdWNbaHVjXSApIHBvaW50c0J5SHVjW2h1Y10ucHVzaChwb2ludHNbaV0pO1xuICAgIGVsc2UgcG9pbnRzQnlIdWNbaHVjXSA9IFtwb2ludHNbaV1dO1xuICB9XG5cbiAgLy8gcmVxdWVzdCBtaXNzaW5nIGh1YyBnZW9qc29uIGFuZC9vciByZW5kZXIgaHVjXG4gIGZvciggdmFyIGh1YyBpbiBwb2ludHNCeUh1YyApIHtcbiAgICBpZiggaHVjID09PSB1bmRlZmluZWQgfHwgaHVjID09PSAndW5kZWZpbmVkJyApIHtcbiAgICAgIGRlYnVnZ2VyO1xuICAgICAgY29udGludWU7XG4gICAgfVxuXG4gICAgaWYoIGh1Y0NhY2hlW2h1Y10gKSByZW5kZXJIdWMoaHVjKTtcbiAgICBlbHNlIGlmKCAhcmVxdWVzdGVkW2h1Y10gKSByZXF1ZXN0KGh1Yyk7XG4gIH1cbn1cblxuZnVuY3Rpb24gcmVxdWVzdChodWNJZCkge1xuICByZXF1ZXN0ZWRbaHVjSWRdID0gMTtcblxuICB2YXIgcXVlcnkgPSBuZXcgZ29vZ2xlLnZpc3VhbGl6YXRpb24uUXVlcnkodXJsUHJlZml4K2h1Y0lkK3VybFBvc3RpeCk7XG4gIHF1ZXJ5LnNldFRpbWVvdXQoNjAqNSk7IC8vIDUgbWluIHRpbWVvdXRcbiAgcXVlcnkuc2VuZChmdW5jdGlvbihyZXNwb25zZSl7XG4gICAgaWYgKHJlc3BvbnNlLmlzRXJyb3IoKSApIHJldHVybiBhbGVydCgnRXJyb3IgcmV0cmlldmluZyBIVUMgMTIgZGF0YSBmb3IgaWQgXCInK2h1Y0lkKydcIicpO1xuXG4gICAgdmFyIGRhdGEgPSByZXNwb25zZS5nZXREYXRhVGFibGUoKTtcblxuICAgIGlmKCBkYXRhLmdldE51bWJlck9mUm93cygpID09IDAgKSB7XG4gICAgICBkZWJ1Z2dlcjtcbiAgICAgIHJldHVybiBhbGVydCgnRXJyb3I6IGludmFsaWQgSFVDIDEyIGlkIFwiJytodWNJZCtcIidcIik7XG4gICAgfVxuXG4gICAgdmFyIGdlb21ldHJ5ID0gSlNPTi5wYXJzZShkYXRhLmdldFZhbHVlKDAsIDApKTtcbiAgICB2YXIgZ2VvanNvbkZlYXR1cmUgPSB7XG4gICAgICBcInR5cGVcIjogXCJGZWF0dXJlXCIsXG4gICAgICBcInByb3BlcnRpZXNcIjoge1xuICAgICAgICAgIFwiaWRcIjogaHVjSWQsXG4gICAgICB9LFxuICAgICAgXCJnZW9tZXRyeVwiOiBnZW9tZXRyeVxuICAgIH07XG4gICAgaHVjQ2FjaGVbaHVjSWRdID0gZ2VvanNvbkZlYXR1cmU7XG5cbiAgICByZW5kZXJIdWMoaHVjSWQpO1xuICB9KTtcbn1cblxuZnVuY3Rpb24gcmVuZGVySHVjKGlkKSB7XG4gIGlmKCAhc2hvd2luZyApIHJldHVybjtcblxuICB2YXIgcG9pbnRzID0gcG9pbnRzQnlIdWNbaWRdO1xuXG4gIC8vIGNhbGN1bGF0ZSBwZXJjZW50IGRlbWFuZFxuICB2YXIgcGVyY2VudERlbWFuZHMgPSBbXSwgZmVhdHVyZTtcbiAgZm9yKCB2YXIgaSA9IDA7IGkgPCBwb2ludHMubGVuZ3RoOyBpKysgKSB7XG4gICAgZmVhdHVyZSA9IHBvaW50c1tpXTtcblxuICAgIGlmKCBmZWF0dXJlLnByb3BlcnRpZXMuYWxsb2NhdGlvbnMgJiYgZmVhdHVyZS5wcm9wZXJ0aWVzLmFsbG9jYXRpb25zLmxlbmd0aCA+IDAgKSB7XG4gICAgICB2YXIgZGVtYW5kID0gZmVhdHVyZS5wcm9wZXJ0aWVzLmFsbG9jYXRpb25zWzBdLmRlbWFuZDtcbiAgICAgIHZhciBhbGxvY2F0aW9uID0gZmVhdHVyZS5wcm9wZXJ0aWVzLmFsbG9jYXRpb25zWzBdLmFsbG9jYXRpb247XG5cbiAgICAgIGlmKCBkZW1hbmQgIT0gMCApIHtcbiAgICAgICAgcGVyY2VudERlbWFuZHMucHVzaChhbGxvY2F0aW9uIC8gZGVtYW5kKTtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICAvLyBjYWxjIGF2ZXJhZ2VcbiAgdmFyIGF2Z1ByZWNlbnREZW1hbmQgPSAtMTtcbiAgdmFyIHRtcCA9IDA7XG4gIGZvciggdmFyIGkgPSAwOyBpIDwgcGVyY2VudERlbWFuZHMubGVuZ3RoOyBpKysgKSB7XG4gICAgdG1wICs9IHBlcmNlbnREZW1hbmRzW2ldO1xuICB9XG4gIGlmKCBwZXJjZW50RGVtYW5kcy5sZW5ndGggPiAwICkgYXZnUHJlY2VudERlbWFuZCA9IHRtcCAvIHBlcmNlbnREZW1hbmRzLmxlbmd0aDtcblxuICB2YXIgbGF5ZXIgPSBMLmdlb0pzb24oXG4gICAgaHVjQ2FjaGVbaWRdLFxuICAgIHtcbiAgICAgIHN0eWxlOiBmdW5jdGlvbihmZWF0dXJlKSB7XG4gICAgICAgIHJldHVybiBtYXJrZXJDb25maWcucGVyY2VudERlbWFuZEh1YyhhdmdQcmVjZW50RGVtYW5kKTtcbiAgICAgIH1cbiAgICB9XG4gICkuYWRkVG8obWFwKTtcblxuICBsYXllcnMucHVzaChsYXllcik7XG59XG5cbm1vZHVsZS5leHBvcnRzID0ge1xuICBpbml0IDogaW5pdCxcbiAgcmVuZGVyIDogcmVuZGVyLFxuICBjbGVhciA6IGNsZWFyXG59O1xuIiwicmVxdWlyZSgnLi9sZWFmbGV0Jyk7IC8vIGltcG9ydCBjdXN0b20gbWFya2VycyB0byBsZWFmbGV0IG5hbWVzcGFjZSAoZ2xvYmFsKVxudmFyIG1hcCA9IHJlcXVpcmUoJy4vbWFwJyk7XG52YXIgaHVjID0gcmVxdWlyZSgnLi9odWMnKTtcbnZhciBmaWxlID0gcmVxdWlyZSgnLi9maWxlJyk7XG52YXIgZGlyZWN0b3J5ID0gcmVxdWlyZSgnLi9saWJyYXJ5Jyk7XG52YXIgZGF0YXN0b3JlID0gcmVxdWlyZSgnLi9kYXRhc3RvcmUnKTtcblxuXG52YXIgbWFwLCBnZW9Kc29uTGF5ZXI7XG52YXIgd21zTGF5ZXJzID0gW107XG52YXIgYWxsRGF0YSA9IFtdO1xuXG4vLyBzaG91bGQgYmUgZmlsbGVkIG9yIGVtcHR5O1xudmFyIHJlbmRlckRlbWFuZCA9ICdlbXB0eSc7XG52YXIgY3VycmVudFBvaW50cyA9IG51bGw7XG52YXIgbGFzdFJlc3BQb2ludHMgPSBudWxsO1xuXG4kKGRvY3VtZW50KS5vbigncmVhZHknLCBmdW5jdGlvbigpe1xuICByZXNpemUoKTtcbiAgaW5pdCgpO1xufSk7XG5cbiQod2luZG93KVxuICAub24oJ3Jlc2l6ZScsIHJlc2l6ZSk7XG5cbmZ1bmN0aW9uIGluaXQoKSB7XG4gIG1hcC5pbml0KHtcbiAgICBkYXRhc3RvcmUgOiBkYXRhc3RvcmUsXG4gICAgaHVjIDogaHVjXG4gIH0pO1xuXG4gIGh1Yy5pbml0KHtcbiAgICBkYXRhc3RvcmUgOiBkYXRhc3RvcmUsXG4gICAgbWFwIDogbWFwXG4gIH0pO1xuXG4gIGZpbGUuaW5pdCh7XG4gICAgZGF0YXN0b3JlIDogZGF0YXN0b3JlLFxuICAgIG1hcCA6IG1hcCxcbiAgICBodWMgOiBodWNcbiAgfSk7XG5cbiAgLy8gcXVpY2tseSBsb2FkcyAvdGVzdGRhdGEvU2FjUml2ZXIuY3N2IGZvciB0ZXN0aW5nXG4gIC8vIHJlcXVpcmUoJy4vdGVzdCcpKGZpbGUpO1xufVxuXG5mdW5jdGlvbiByZXNpemUoKSB7XG4gIHZhciBoID0gd2luZG93LmlubmVySGVpZ2h0O1xuICB2YXIgdyA9IHdpbmRvdy5pbm5lcldpZHRoO1xuICBpZiggaCA9PT0gbnVsbCApIGggPSAkKHdpbmRvdykuaGVpZ2h0KCk7XG4gIGlmKCB3ID09PSBudWxsICkgdyA9ICQod2luZG93KS53aWR0aCgpO1xuXG4gICQoJyNtYXAnKS5oZWlnaHQoaCkud2lkdGgodyk7XG4gICQoJyNpbmZvJykuY3NzKCdtYXgtaGVpZ2h0JywgKGgtODUpKydweCcpO1xufVxuXG5tb2R1bGUuZXhwb3J0cyA9IHtcbiAgbWFwIDogbWFwLFxuICBodWMgOiBodWMsXG4gIGZpbGUgOiBmaWxlLFxuICBkaXJlY3RvcnkgOiBkaXJlY3RvcnksXG4gIGRzIDogZGF0YXN0b3JlXG59O1xuIiwidmFyIEljb25SZW5kZXJlciA9IHJlcXVpcmUoJy4uL21hcmtlcnMvaWNvblJlbmRlcmVyJyk7XG5cbkwuSWNvbi5DYW52YXMgPSBMLkljb24uZXh0ZW5kKHtcbiAgICBvcHRpb25zOiB7XG4gICAgICAgIGljb25TaXplOiBuZXcgTC5Qb2ludCgyMCwgMjApLCAvLyBIYXZlIHRvIGJlIHN1cHBsaWVkXG4gICAgICAgIGNsYXNzTmFtZTogJ2xlYWZsZXQtY2FudmFzLWljb24nXG4gICAgfSxcblxuICAgIGNyZWF0ZUljb246IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgdmFyIGUgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdjYW52YXMnKTtcbiAgICAgICAgdGhpcy5fc2V0SWNvblN0eWxlcyhlLCAnaWNvbicpO1xuXG4gICAgICAgIGUud2lkdGggPSB0aGlzLm9wdGlvbnMud2lkdGg7XG4gICAgICAgIGUuaGVpZ2h0ID0gdGhpcy5vcHRpb25zLmhlaWdodDtcblxuICAgICAgICBlLnN0eWxlLm1hcmdpblRvcCA9ICgtMSp0aGlzLm9wdGlvbnMud2lkdGgvMikrJ3B4JztcbiAgICAgICAgZS5zdHlsZS5tYXJnaW5MZWZ0ID0gKC0xKnRoaXMub3B0aW9ucy5oZWlnaHQvMikrJ3B4JztcblxuICAgICAgICBlLnN0eWxlLndpZHRoID0gdGhpcy5vcHRpb25zLndpZHRoKydweCc7XG4gICAgICAgIGUuc3R5bGUuaGVpZ2h0ID10aGlzLm9wdGlvbnMuaGVpZ2h0KydweCc7XG5cbiAgICAgICAgdGhpcy5kcmF3KGUuZ2V0Q29udGV4dCgnMmQnKSk7XG5cbiAgICAgICAgcmV0dXJuIGU7XG4gICAgfSxcblxuICAgIGNyZWF0ZVNoYWRvdzogZnVuY3Rpb24gKCkge1xuICAgICAgICByZXR1cm4gbnVsbDtcbiAgICB9LFxuXG5cbiAgICBkcmF3OiBmdW5jdGlvbihjdHgpIHtcbiAgICAgIEljb25SZW5kZXJlcihjdHgsIHRoaXMub3B0aW9ucyk7XG4gICAgfVxufSk7XG4iLCJMLmR3cmF0TWFya2VyID0gZnVuY3Rpb24gKGxhdGxuZywgb3B0aW9ucykge1xuICB2YXIgbWFya2VyID0gbmV3IEwuTWFya2VyKGxhdGxuZywge1xuICAgICAgaWNvbjogbmV3IEwuSWNvbi5DYW52YXMob3B0aW9ucyksXG4gICAgICBpY29uU2l6ZTogbmV3IEwuUG9pbnQob3B0aW9ucy53aWR0aCwgb3B0aW9ucy5oZWlnaHQpLFxuICB9KTtcblxuICBtYXJrZXIuc2V0U3R5bGUgPSBmdW5jdGlvbihvcHRpb25zKSB7XG4gICAgdmFyIG8gPSB0aGlzLm9wdGlvbnMuaWNvbi5vcHRpb25zO1xuXG4gICAgJC5leHRlbmQodHJ1ZSwgbywgb3B0aW9ucyk7XG4gICAgaWYoICF0aGlzLl9pY29uICkgcmV0dXJuO1xuXG4gICAgdmFyIGN0eCA9IHRoaXMuX2ljb24uZ2V0Q29udGV4dCgnMmQnKTtcbiAgICBjdHguY2xlYXJSZWN0KDAsIDAsIG8ud2lkdGgsIG8uaGVpZ2h0KTtcblxuICAgIEljb25SZW5kZXJlcihjdHgsIG8pO1xuICB9XG5cbiAgcmV0dXJuIG1hcmtlcjtcbn07XG4iLCJyZXF1aXJlKCcuL2NhbnZhcycpO1xucmVxdWlyZSgnLi9kd3JhdCcpO1xuIiwidmFyIERyb3VnaHRJY29uID0gcmVxdWlyZSgnLi4vbWFya2Vycy9kcm91Z2h0SWNvbicpO1xudmFyIG1hcmtlckNvbmZpZyA9IHJlcXVpcmUoJy4uL21hcmtlcnMvY29uZmlnJyk7XG52YXIgbWFya2VycyA9IG1hcmtlckNvbmZpZy5kZWZhdWx0cztcbnZhciBtYXAsIGRhdGFzdG9yZTtcblxuZ2xvYmFsLnNldHRpbmdzID0ge1xuICByZW5kZXJEZW1hbmQgOiAnZW1wdHknXG59O1xuXG5tb2R1bGUuZXhwb3J0cy5pbml0ID0gZnVuY3Rpb24oY29uZmlnKSB7XG4gIG1hcCA9IGNvbmZpZy5tYXA7XG4gIGRhdGFzdG9yZSA9IGNvbmZpZy5kYXRhc3RvcmU7XG5cbiAgdmFyIGRlbWFuZFN0ZXBzID0gWzAsIDEsIDUwLCAxMDAsIDI1MF07XG5cbiAgdmFyIG9wdGlvbnMgPSAkLmV4dGVuZCh0cnVlLCB7fSwgbWFya2Vycy5yaXBhcmlhbi51bmFsbG9jYXRlZCk7XG4gIG9wdGlvbnMuc2lkZXMgPSAwO1xuICB2YXIgaWNvbiA9IG5ldyBEcm91Z2h0SWNvbihvcHRpb25zKTtcbiAgJCgnI2xlZ2VuZC1yaXBhcmlhbicpLmFwcGVuZCgkKGljb24uZWxlKSk7XG5cblxuICBvcHRpb25zID0gJC5leHRlbmQodHJ1ZSwge30sIG1hcmtlcnMuYXBwbGljYXRpb24udW5hbGxvY2F0ZWQpO1xuICBvcHRpb25zLnNpZGVzID0gMztcbiAgb3B0aW9ucy5yb3RhdGUgPSA5MDtcbiAgaWNvbiA9IG5ldyBEcm91Z2h0SWNvbihvcHRpb25zKTtcbiAgJCgnI2xlZ2VuZC1wcmUtYXBwcm9wcmlhdGl2ZScpLmFwcGVuZCgkKGljb24uZWxlKSk7XG5cbiAgaWNvbiA9IG5ldyBEcm91Z2h0SWNvbihtYXJrZXJzLmFwcGxpY2F0aW9uLnVuYWxsb2NhdGVkKTtcbiAgJCgnI2xlZ2VuZC1wb3N0LWFwcHJvcHJpYXRpdmUnKS5hcHBlbmQoJChpY29uLmVsZSkpO1xuXG4gIHZhciB0YWJsZSA9ICc8dGFibGUgc3R5bGU9XCJ0ZXh0LWFsaWduOmNlbnRlclwiPjx0ciBzdHlsZT1cInZlcnRpY2FsLWFsaWduOiBib3R0b21cIj4nO1xuICB2YXIgaWNvbnMgPSBbXTtcbiAgZm9yKCB2YXIgaSA9IDA7IGkgPCBkZW1hbmRTdGVwcy5sZW5ndGg7IGkrKyApIHtcbiAgICB0YWJsZSArPSAnPHRkIHN0eWxlPVwicGFkZGluZzo0cHhcIj48ZGl2IGlkPVwibGVnZW5kLWRlbWFuZC0nK2krJ1wiPjwvZGl2PjxkaXY+JytcbiAgICAgICAgICAgICAgKGRlbWFuZFN0ZXBzW2ldID09IDEgPyAnPCcgOiAnJykgK1xuICAgICAgICAgICAgICAoZGVtYW5kU3RlcHNbaV0gPT0gMjUwID8gJz4nIDogJycpICtcbiAgICAgICAgICAgICAgZGVtYW5kU3RlcHNbaV0rJzwvZGl2PjwvdGQ+JztcblxuXG4gICAgaWYoIGRlbWFuZFN0ZXBzW2ldID09PSAwICkge1xuICAgICAgb3B0aW9ucyA9ICQuZXh0ZW5kKHRydWUsIHt9LCBtYXJrZXJzLmFwcGxpY2F0aW9uLnVuYWxsb2NhdGVkKTtcbiAgICAgIG9wdGlvbnMgPSAkLmV4dGVuZCh0cnVlLCBvcHRpb25zLCBtYXJrZXJzLm5vRGVtYW5kKTtcbiAgICB9IGVsc2Uge1xuICAgICAgb3B0aW9ucyA9ICQuZXh0ZW5kKHRydWUsIHt9LCBtYXJrZXJzLmFwcGxpY2F0aW9uLnVuYWxsb2NhdGVkKTtcblxuICAgICAgdmFyIHNpemUgPSBNYXRoLnNxcnQoZGVtYW5kU3RlcHNbaV0pICogMztcbiAgICAgIGlmKCBzaXplID4gNTAgKSBzaXplID0gNTA7XG4gICAgICBpZiggc2l6ZSA8IDcgKSBzaXplID0gNztcblxuICAgICAgb3B0aW9ucy5oZWlnaHQgPSAoc2l6ZSoyKSsyO1xuICAgICAgb3B0aW9ucy53aWR0aCA9IChzaXplKjIpKzI7XG4gICAgfVxuXG4gICAgaWNvbnMucHVzaChuZXcgRHJvdWdodEljb24ob3B0aW9ucykpO1xuICB9XG4gICQoJyNsZWdlbmQtZGVtYW5kJykuaHRtbCh0YWJsZSsnPC90cj48L3RhYmxlPicpO1xuXG4gIGZvciggaSA9IDA7IGkgPCBpY29ucy5sZW5ndGg7IGkrKyApIHtcbiAgICAkKCcjbGVnZW5kLWRlbWFuZC0nK2kpLmFwcGVuZCgkKGljb25zW2ldLmVsZSkpO1xuICB9XG5cbiAgdGhpcy5yZWRyYXdQRGVtYW5kTGVnZW5kKCk7XG5cbiAgLy8gaW5pdCB0b2dnbGUgYnV0dG9uXG5cbiAgJCgnI2xlZ2VuZFRvZ2dsZScpLm9uKCdjbGljaycsIGZ1bmN0aW9uKCl7XG4gICAgaWYoIHRoaXMuaGFzQXR0cmlidXRlKCdzaG93aW5nJykgKSB7XG4gICAgICB0aGlzLnJlbW92ZUF0dHJpYnV0ZSgnc2hvd2luZycpO1xuICAgICAgJCgnI2xlZ2VuZCcpLmhpZGUoJ3Nsb3cnKTtcbiAgICAgIHRoaXMuaW5uZXJIVE1MID0gJzxpIGNsYXNzPVwiZmEgZmEtYXJyb3ctcmlnaHRcIj48L2k+JztcblxuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLnNldEF0dHJpYnV0ZSgnc2hvd2luZycsICcnKTtcbiAgICAgICQoJyNsZWdlbmQnKS5zaG93KCdzbG93Jyk7XG4gICAgICB0aGlzLmlubmVySFRNTCA9ICc8aSBjbGFzcz1cImZhIGZhLWFycm93LWRvd25cIj48L2k+JztcbiAgICB9XG4gIH0pO1xuXG4gICQoJyNyZW5kZXJUeXBlRmlsbGVkJykub24oJ2NsaWNrJywgb25SZW5kZXJUeXBlQ2hhbmdlKTtcbiAgJCgnI3JlbmRlclR5cGVFbXB0eScpLm9uKCdjbGljaycsIG9uUmVuZGVyVHlwZUNoYW5nZSk7XG5cbiAgJCgnI3Nob3dOb0RlbWFuZCcpLm9uKCdjbGljaycsIGZ1bmN0aW9uKCl7XG4gICAgbWFwLmdlb2pzb24uY2xlYXJMYXllcigpO1xuICAgIHZhciBub0RlbWFuZCA9ICEkKHRoaXMpLmlzKCc6Y2hlY2tlZCcpO1xuICAgIG1hcC5nZW9qc29uLmFkZChkYXRhc3RvcmUuZ2V0KG5vRGVtYW5kKSk7XG4gIH0pO1xufTtcblxuZnVuY3Rpb24gcmVkcmF3UERlbWFuZExlZ2VuZCgpIHtcbiAgdmFyIHBlcmNlbnRTdGVwcyA9IFswLCAyNSwgNTAsIDc1LCAxMDBdLCBpO1xuXG4gIHZhciB0YWJsZSA9ICc8dGFibGUgc3R5bGU9XCJ0ZXh0LWFsaWduOmNlbnRlclwiPjx0ciBzdHlsZT1cInZlcnRpY2FsLWFsaWduOiBib3R0b21cIj4nO1xuICB2YXIgaWNvbnMgPSBbXTtcblx0Zm9yKCBpID0gMDsgaSA8IHBlcmNlbnRTdGVwcy5sZW5ndGg7IGkrKyApIHtcblx0XHR0YWJsZSArPSAnPHRkIHN0eWxlPVwicGFkZGluZzo4cHhcIj48ZGl2IGlkPVwibGVnZW5kLXByZWNlbnQtb2YtZGVtYW5kLScraSsnXCI+PC9kaXY+PGRpdj4nK1xuXHRcdFx0XHRcdHBlcmNlbnRTdGVwc1tpXSsnJTwvZGl2PjwvdGQ+JztcblxuXHRcdHZhciBvcHRpb25zID0gJC5leHRlbmQodHJ1ZSwge30sIG1hcmtlcnMuYXBwbGljYXRpb24udW5hbGxvY2F0ZWQpO1xuXG4gICAgbWFya2VyQ29uZmlnLnBlcmNlbnREZW1hbmQob3B0aW9ucywgcGVyY2VudFN0ZXBzW2ldIC8gMTAwKTtcblxuXHRcdGljb25zLnB1c2gobmV3IERyb3VnaHRJY29uKG9wdGlvbnMpKTtcblx0fVxuXHQkKCcjbGVnZW5kLXByZWNlbnQtb2YtZGVtYW5kJykuaHRtbCh0YWJsZSsnPC90cj48L3RhYmxlPicpO1xuXG5cdGZvciggaSA9IDA7IGkgPCBpY29ucy5sZW5ndGg7IGkrKyApIHtcblx0XHQkKCcjbGVnZW5kLXByZWNlbnQtb2YtZGVtYW5kLScraSkuYXBwZW5kKCQoaWNvbnNbaV0uZWxlKSk7XG5cdH1cbn07XG5tb2R1bGUuZXhwb3J0cy5yZWRyYXdQRGVtYW5kTGVnZW5kID0gcmVkcmF3UERlbWFuZExlZ2VuZDtcblxuZnVuY3Rpb24gb25SZW5kZXJUeXBlQ2hhbmdlKCkge1xuICB2YXIgc2V0dGluZ3MgPSBnbG9iYWwuc2V0dGluZ3M7XG4gIHZhciBpc0ZpbGxlZENoZWNrZWQgPSAkKCcjcmVuZGVyVHlwZUZpbGxlZCcpLmlzKCc6Y2hlY2tlZCcpO1xuICB2YXIgbmV3VmFsID0gaXNGaWxsZWRDaGVja2VkID8gJ2ZpbGxlZCcgOiAnZW1wdHknO1xuXG4gIGlmKCBzZXR0aW5ncy5yZW5kZXJEZW1hbmQgPT0gbmV3VmFsICkgcmV0dXJuO1xuICBzZXR0aW5ncy5yZW5kZXJEZW1hbmQgPSBuZXdWYWw7XG5cbiAgLy8gcmVuZGVyIGxlZ2VuZFxuICByZWRyYXdQRGVtYW5kTGVnZW5kKCk7XG5cbiAgaWYoICFjdXJyZW50UG9pbnRzICkgcmV0dXJuO1xuXG4gIG1hcC5nZW9qc29uLmNsZWFyTGF5ZXIoKTtcbiAgdmFyIG5vRGVtYW5kID0gISQodGhpcykuaXMoJzpjaGVja2VkJyk7XG4gIG1hcC5nZW9qc29uLmFkZChkYXRhc3RvcmUuZ2V0KG5vRGVtYW5kKSk7XG59XG5cbmZ1bmN0aW9uIHN0YW1wKGRhdGEpIHtcbiAgdmFyIHRlbXBsYXRlID0gbWFya2VyVGVtcGxhdGU7XG4gIGZvciggdmFyIGtleSBpbiBkYXRhICkgdGVtcGxhdGUgPSB0ZW1wbGF0ZS5yZXBsYWNlKCd7eycra2V5Kyd9fScsIGRhdGFba2V5XSk7XG4gIHJldHVybiB0ZW1wbGF0ZTtcbn1cbiIsInZhciBmaWxlcyA9IFtdO1xuXG52YXIgcm9vdCA9ICdodHRwczovL2RvY3MuZ29vZ2xlLmNvbS9zcHJlYWRzaGVldHMvZC8xQUNpN1AwcE95LUpSanR3NkhyaWJRcGhoRU9aLTAtQ2tRX21xbnlDZkpjSS9ndml6L3RxJztcblxuZnVuY3Rpb24gaW5pdChyZXNwKSB7XG4gIHZhciBxdWVyeSA9IG5ldyBnb29nbGUudmlzdWFsaXphdGlvbi5RdWVyeShyb290KTtcbiAgcXVlcnkuc2VuZChvbkluaXRMb2FkKTtcbn1cblxuZnVuY3Rpb24gb25Jbml0TG9hZChyZXNwKSB7XG4gIGlmIChyZXNwLmlzRXJyb3IoKSkge1xuICAgIGFsZXJ0KCdFcnJvciBpbiBsb2FkaW5nIHB1YmxpYyBkYXRhOiAnICsgcmVzcG9uc2UuZ2V0TWVzc2FnZSgpICsgJyAnICsgcmVzcG9uc2UuZ2V0RGV0YWlsZWRNZXNzYWdlKCkpO1xuICAgIHJldHVybjtcbiAgfVxuXG4gIHZhciBkYXRhID0gcmVzcC5nZXREYXRhVGFibGUoKTtcbiAgdmFyIHJvd0xlbiA9IGRhdGEuZ2V0TnVtYmVyT2ZSb3dzKCk7XG4gIHZhciBjb2xMZW4gPSBkYXRhLmdldE51bWJlck9mQ29sdW1ucygpO1xuXG5cbiAgZm9yKCB2YXIgaSA9IDA7IGkgPCByb3dMZW47IGkrKyApIHtcbiAgICB2YXIgZmlsZSA9IHt9O1xuICAgIGZvciggdmFyIGogPSAwOyBqIDwgY29sTGVuOyBqKysgKSB7XG4gICAgICBmaWxlW2RhdGEuZ2V0Q29sdW1uSWQoaildID0gZGF0YS5nZXRWYWx1ZShpLCBqKTtcbiAgICB9XG4gICAgZmlsZXMucHVzaChmaWxlKTtcbiAgfVxuXG4gIGNvbnNvbGUubG9nKGZpbGVzKTtcbn1cblxubW9kdWxlLmV4cG9ydHMgPSB7XG4gIGluaXQgOiBpbml0XG59O1xuIiwidmFyIG1hcmtlckNvbmZpZyA9IHJlcXVpcmUoJy4uL21hcmtlcnMvY29uZmlnJyk7XG52YXIgbWFya2VycyA9IG1hcmtlckNvbmZpZy5kZWZhdWx0cztcblxudmFyIGdlb0pzb25MYXllcjtcbnZhciBtYXAsIGh1YywgZGF0YXN0b3JlO1xuXG5tb2R1bGUuZXhwb3J0cy5pbml0ID0gZnVuY3Rpb24oY29uZmlnKSB7XG4gIG1hcCA9IGNvbmZpZy5tYXAuZ2V0TGVhZmxldCgpO1xuICBkYXRhc3RvcmUgPSBjb25maWcuZGF0YXN0b3JlO1xuICBodWMgPSBjb25maWcuaHVjO1xufTtcblxubW9kdWxlLmV4cG9ydHMuYWRkID0gZnVuY3Rpb24ocG9pbnRzKSB7XG4gIHZhciBzaG93Tm9EZW1hbmQgPSAkKCcjc2hvd05vRGVtYW5kJykuaXMoJzpjaGVja2VkJyk7XG4gIGRhdGFzdG9yZS5jbGVhckZlYXR1cmVzKCk7XG5cbiAgaWYoICFzaG93Tm9EZW1hbmQgKSB7XG4gICAgdG1wID0gW107XG4gICAgZm9yKCB2YXIgaSA9IHBvaW50cy5sZW5ndGgtMTsgaSA+PSAwOyBpLS0gKSB7XG4gICAgICBpZiggcG9pbnRzW2ldLnByb3BlcnRpZXMuYWxsb2NhdGlvbnMgJiYgcG9pbnRzW2ldLnByb3BlcnRpZXMuYWxsb2NhdGlvbnMubGVuZ3RoID4gMCApIHtcblxuICAgICAgICB2YXIgZGVtYW5kID0gcG9pbnRzW2ldLnByb3BlcnRpZXMuYWxsb2NhdGlvbnNbMF0uZGVtYW5kO1xuICAgICAgICBpZiggZGVtYW5kICE9PSAwICkgdG1wLnB1c2gocG9pbnRzW2ldKTtcbiAgICAgIH1cbiAgICB9XG4gICAgcG9pbnRzID0gdG1wO1xuICB9XG5cbiAgZ2VvSnNvbkxheWVyID0gTC5nZW9Kc29uKHBvaW50cyx7XG4gICAgcG9pbnRUb0xheWVyOiBmdW5jdGlvbiAoZmVhdHVyZSwgbGF0bG5nKSB7XG4gICAgICB2YXIgdHlwZSA9IGZlYXR1cmUucHJvcGVydGllcy5yaXBhcmlhbiA/ICdyaXBhcmlhbicgOiAnYXBwbGljYXRpb24nO1xuICAgICAgdmFyIGFsbG9jYXRpb24gPSAndW5hbGxvY2F0ZWQnO1xuXG4gICAgICBmb3IoIHZhciBpID0gMDsgaSA8IGZlYXR1cmUucHJvcGVydGllcy5hbGxvY2F0aW9ucy5sZW5ndGg7IGkrKyApIHtcbiAgICAgICAgaWYoIGZlYXR1cmUucHJvcGVydGllcy5hbGxvY2F0aW9uc1tpXS5hbGxvY2F0aW9uID4gMCApIGFsbG9jYXRpb24gPSAnYWxsb2NhdGVkJztcbiAgICAgIH1cblxuXG4gICAgICB2YXIgb3B0aW9ucyA9ICQuZXh0ZW5kKHRydWUsIHt9LCBtYXJrZXJzW3R5cGVdW2FsbG9jYXRpb25dKTtcblxuICAgICAgaWYoIGZlYXR1cmUucHJvcGVydGllcy5hbGxvY2F0aW9ucyAmJiBmZWF0dXJlLnByb3BlcnRpZXMuYWxsb2NhdGlvbnMubGVuZ3RoID4gMCApIHtcblxuICAgICAgICB2YXIgZGVtYW5kID0gZmVhdHVyZS5wcm9wZXJ0aWVzLmFsbG9jYXRpb25zWzBdLmRlbWFuZDtcbiAgICAgICAgdmFyIGFsbG9jYXRpb24gPSBmZWF0dXJlLnByb3BlcnRpZXMuYWxsb2NhdGlvbnNbMF0uYWxsb2NhdGlvbjtcblxuICAgICAgICBpZiggZGVtYW5kID09PSAwICkge1xuXG4gICAgICAgICAgJC5leHRlbmQodHJ1ZSwgb3B0aW9ucywgbWFya2Vycy5ub0RlbWFuZCk7XG4gICAgICAgICAgZmVhdHVyZS5wcm9wZXJ0aWVzLm5vRGVtYW5kID0gdHJ1ZTtcblxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIG1hcmtlckNvbmZpZy5wZXJjZW50RGVtYW5kKG9wdGlvbnMsIGFsbG9jYXRpb24gLyBkZW1hbmQpO1xuXG4gICAgICAgICAgdmFyIHNpemUgPSBNYXRoLnNxcnQoZGVtYW5kKSAqIDM7XG4gICAgICAgICAgaWYoIHNpemUgPiA1MCApIHNpemUgPSA1MDtcbiAgICAgICAgICBpZiggc2l6ZSA8IDcgKSBzaXplID0gNztcblxuICAgICAgICAgIG9wdGlvbnMuaGVpZ2h0ID0gc2l6ZSoyO1xuICAgICAgICAgIG9wdGlvbnMud2lkdGggPSBzaXplKjI7XG4gICAgICAgIH1cbiAgICAgIH1cblxuXG5cbiAgICAgIHZhciBtYXJrZXI7XG4gICAgICB2YXIgZDtcbiAgICAgIHRyeSB7XG4gICAgICAgIGQgPSBmZWF0dXJlLnByb3BlcnRpZXMucHJpb3JpdHlfZGF0ZSA/IHBhcnNlSW50KGZlYXR1cmUucHJvcGVydGllcy5wcmlvcml0eV9kYXRlLnJlcGxhY2UoLy0uKi8sJycpKSA6IDIwMDA7XG4gICAgICB9IGNhdGNoKGUpIHtcbiAgICAgICAgZCA9IDIwMDA7XG4gICAgICB9XG5cbiAgICAgIGlmKCBmZWF0dXJlLnByb3BlcnRpZXMucmlwYXJpYW4gKSB7XG4gICAgICAgIG9wdGlvbnMuc2lkZXMgPSAwO1xuICAgICAgICBtYXJrZXIgPSBMLmR3cmF0TWFya2VyKGxhdGxuZywgb3B0aW9ucyk7XG4gICAgICB9IGVsc2UgaWYgKCBkIDwgMTkxNCApIHtcbiAgICAgICAgb3B0aW9ucy5zaWRlcyA9IDM7XG4gICAgICAgIG9wdGlvbnMucm90YXRlID0gOTA7XG4gICAgICAgIG1hcmtlciA9IEwuZHdyYXRNYXJrZXIobGF0bG5nLCBvcHRpb25zKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIG1hcmtlciA9IEwuZHdyYXRNYXJrZXIobGF0bG5nLCBvcHRpb25zKTtcbiAgICAgIH1cblxuICAgICAgZGF0YXN0b3JlLmFkZEZlYXR1cmUoe1xuICAgICAgICBmZWF0dXJlIDogZmVhdHVyZSxcbiAgICAgICAgbWFya2VyICA6IG1hcmtlclxuICAgICAgfSk7XG4gICAgICByZXR1cm4gbWFya2VyO1xuICAgIH1cbiAgfSkuYWRkVG8obWFwKTtcblxuICBnZW9Kc29uTGF5ZXIub24oJ2NsaWNrJywgZnVuY3Rpb24oZSkge1xuICAgICQoJy5zZWxlY3QtdGV4dCcpLnJlbW92ZSgpO1xuICAgICQoJyNpbmZvJykuc2hvdygpO1xuICAgIHZhciBwcm9wcyA9IGUubGF5ZXIuZmVhdHVyZS5wcm9wZXJ0aWVzO1xuXG4gICAgc2VsZWN0KGUubGF5ZXIpO1xuXG4gICAgdmFyIGxsID0gZS5sYXllci5mZWF0dXJlLmdlb21ldHJ5LmNvb3JkaW5hdGVzO1xuXG4gICAgdmFyIHQsIGh0bWwgPSAnJztcbiAgICB2YXIgYWxsRGF0YSA9IGRhdGFzdG9yZS5nZXRGZWF0dXJlcygpO1xuICAgIGZvciggdmFyIGkgPSAwOyBpIDwgYWxsRGF0YS5sZW5ndGg7IGkrKyApIHtcbiAgICAgIHQgPSBhbGxEYXRhW2ldLmZlYXR1cmUuZ2VvbWV0cnkuY29vcmRpbmF0ZXM7XG4gICAgICBpZiggbGxbMF0udG9GaXhlZCg0KSA9PSB0WzBdLnRvRml4ZWQoNCkgJiYgbGxbMV0udG9GaXhlZCg0KSA9PSB0WzFdLnRvRml4ZWQoNCkgKSB7XG4gICAgICAgIHZhciBwID0gYWxsRGF0YVtpXS5mZWF0dXJlLnByb3BlcnRpZXM7XG5cbiAgICAgICAgaHRtbCArPSBzdGFtcCh7XG4gICAgICAgICAgYXBwbGljYXRpb25fbnVtYmVyIDogcC5hcHBsaWNhdGlvbl9udW1iZXIsXG4gICAgICAgICAgZGF0ZSA6IHAuYWxsb2NhdGlvbnNbMF0uZGF0ZSxcbiAgICAgICAgICBhbGxvY2F0aW9uIDogcC5hbGxvY2F0aW9uc1swXS5hbGxvY2F0aW9uLFxuICAgICAgICAgIGRlbWFuZCA6IHAuYWxsb2NhdGlvbnNbMF0uZGVtYW5kLFxuICAgICAgICAgIHJhdGlvIDogcC5hbGxvY2F0aW9uc1swXS5yYXRpbyAhPT0gbnVsbCA/IChwLmFsbG9jYXRpb25zWzBdLnJhdGlvKjEwMCkudG9GaXhlZCgyKSA6ICcxMDAnLFxuICAgICAgICAgIHdhdGVyX3JpZ2h0X3R5cGUgOiBwWydSaWdodCBUeXBlJ10sXG4gICAgICAgICAgcHJpb3JpdHlfZGF0ZSA6IHAucHJpb3JpdHlfZGF0ZSA/IHAucHJpb3JpdHlfZGF0ZSA6ICdVbmtub3duJ1xuICAgICAgICB9KTtcbiAgICAgIH1cbiAgICB9XG5cblxuICAgICQoJyNpbmZvLXJlc3VsdCcpLmh0bWwoaHRtbCk7XG4gICAgJCgnI2luZm8nKS5hbmltYXRlKHtcbiAgICAgIHNjcm9sbFRvcDogJCgnLmluZm8tYm94JykuaGVpZ2h0KClcbiAgICB9LCAzMDApO1xuICB9KTtcblxuICBjdXJyZW50UG9pbnRzID0gcG9pbnRzO1xuXG4gIGh1Yy5yZW5kZXIocG9pbnRzKTtcbn07XG5cbm1vZHVsZS5leHBvcnRzLmNsZWFyTGF5ZXIgPSBmdW5jdGlvbigpIHtcbiAgaWYoIGdlb0pzb25MYXllciApIG1hcC5yZW1vdmVMYXllcihnZW9Kc29uTGF5ZXIpO1xufTtcbiIsInZhciBtYXA7XG52YXIgYmFzZU1hcHMgPSB7fTtcbnZhciBvdmVybGF5TWFwcyA9IHt9O1xuXG52YXIgZ2VvanNvbiA9IHJlcXVpcmUoJy4vZ2VvanNvbicpO1xudmFyIGdlb2pzb25MYXllciA9IHt9O1xuXG52YXIgY3VycmVudFBvaW50cyA9IG51bGw7XG52YXIgY3VycmVudEdlb2pzb24gPSBudWxsO1xuXG5tb2R1bGUuZXhwb3J0cy5sZWdlbmQgPSByZXF1aXJlKCcuLi9sZWdlbmQnKTtcbm1vZHVsZS5leHBvcnRzLmdlb2pzb24gPSByZXF1aXJlKCcuL2dlb2pzb24nKTtcblxuXG5cbm1vZHVsZS5leHBvcnRzLmluaXQgPSBmdW5jdGlvbihvcHRpb25zKSB7XG4gIG1hcCA9IEwubWFwKCdtYXAnLHt0cmFja1Jlc2l6ZTp0cnVlfSk7XG5cbiAgLy8gYWRkIGFuIE9wZW5TdHJlZXRNYXAgdGlsZSBsYXllclxuICBMLnRpbGVMYXllcignaHR0cDovL3tzfS50aWxlLm9zbS5vcmcve3p9L3t4fS97eX0ucG5nJywge1xuICAgICAgYXR0cmlidXRpb246ICcmY29weTsgPGEgaHJlZj1cImh0dHA6Ly9vc20ub3JnL2NvcHlyaWdodFwiPk9wZW5TdHJlZXRNYXA8L2E+IGNvbnRyaWJ1dG9ycydcbiAgfSkuYWRkVG8obWFwKTtcblxuICB2YXIgd21zMSA9IEwudGlsZUxheWVyLndtcyhcImh0dHBzOi8vbWFwc2VuZ2luZS5nb29nbGUuY29tLzE1NTQyNjAwNzM0Mjc1NTQ5NDQ0LTExODUzNjY3MjczMTMxNTUwMzQ2LTQvd21zLz92ZXJzaW9uPTEuMy4wXCIsIHtcbiAgICAgIGxheWVyczogJzE1NTQyNjAwNzM0Mjc1NTQ5NDQ0LTA4MTEyOTc0NjkwOTkxMTY0NTg3LTQnLFxuICAgICAgZm9ybWF0OiAnaW1hZ2UvcG5nJyxcbiAgICAgIHRyYW5zcGFyZW50OiB0cnVlLFxuICAgICAgYXR0cmlidXRpb246IFwiXCIsXG4gICAgICBib3VuZHMgOiBMLmxhdExuZ0JvdW5kcyhcbiAgICAgICAgTC5sYXRMbmcoNDIuMDA5NDMxOTg4MDQwNTgsIC0xMTQuMTMwNzU5NzIxMzQwNyksXG4gICAgICAgIEwubGF0TG5nKDMyLjUzNDI2MzQ1MzY3NDkzLCAtMTI0LjQwOTcxMTcxNjc4Mjk4KVxuICAgICAgKVxuICB9KS5hZGRUbyhtYXApO1xuXG4gIHZhciB3bXMyID0gTC50aWxlTGF5ZXIud21zKFwiaHR0cHM6Ly9tYXBzZW5naW5lLmdvb2dsZS5jb20vMTU1NDI2MDA3MzQyNzU1NDk0NDQtMTE4NTM2NjcyNzMxMzE1NTAzNDYtNC93bXMvP3ZlcnNpb249MS4zLjBcIiwge1xuICAgICAgbGF5ZXJzOiAnMTU1NDI2MDA3MzQyNzU1NDk0NDQtMTYxNDMxNTg2ODk2MDMzNjEwOTMtNCcsXG4gICAgICBmb3JtYXQ6ICdpbWFnZS9wbmcnLFxuICAgICAgdHJhbnNwYXJlbnQ6IHRydWUsXG4gICAgICBhdHRyaWJ1dGlvbjogXCJcIixcbiAgICAgIGJvdW5kcyA6IEwubGF0TG5nQm91bmRzKFxuICAgICAgICBMLmxhdExuZyg0Mi4wMDk0MzE5ODgwNDA1OCwgLTExNC4xMzA3NTk3MjEzNDA3KSxcbiAgICAgICAgTC5sYXRMbmcoMzIuNTM0MjYzNDUzNjc0OTMsIC0xMjQuNDA5NzExNzE2NzgyOTgpXG4gICAgICApXG4gIH0pO1xuXG4gIGJhc2VNYXBzID0ge307XG4gIG92ZXJsYXlNYXBzID0ge1xuICAgICdXYXRlcnNoZWRzJzogd21zMSxcbiAgICAnSFVDIDEyJzogd21zMlxuICB9O1xuXG4gIEwuY29udHJvbC5sYXllcnMoYmFzZU1hcHMsIG92ZXJsYXlNYXBzLCB7cG9zaXRpb246ICdib3R0b21sZWZ0J30pLmFkZFRvKG1hcCk7XG5cbiAgb3B0aW9ucy5tYXAgPSB0aGlzO1xuICBnZW9qc29uLmluaXQob3B0aW9ucyk7XG4gIHRoaXMubGVnZW5kLmluaXQob3B0aW9ucyk7XG59O1xuXG5tb2R1bGUuZXhwb3J0cy5jbGVhckdlb2pzb25MYXllciA9IGZ1bmN0aW9uKCkge1xuICBnZW9qc29uLmNsZWFyTGF5ZXIoKTtcbn07XG5tb2R1bGUuZXhwb3J0cy5nZXRMZWFmbGV0ID0gZnVuY3Rpb24oKSB7XG4gIHJldHVybiBtYXA7XG59O1xuIiwidmFyIG1hcmtlcnMgPSB7XG4gIHJpcGFyaWFuIDoge1xuICAgIGFsbG9jYXRlZCA6IHtcbiAgICAgIGZpbGxDb2xvciAgIDogXCIjMjUyNUM5XCIsXG4gICAgICBjb2xvciAgICAgICA6IFwiIzMzMzMzM1wiLFxuICAgICAgd2VpZ2h0ICAgICAgOiAxLFxuICAgICAgb3BhY2l0eSAgICAgOiAxLFxuICAgICAgZmlsbE9wYWNpdHkgOiAwLjMsXG5cdFx0XHRzaWRlcyA6IDMsXG5cdFx0XHRyb3RhdGUgOiA5MCxcbiAgICAgIHdpZHRoOiAyMCxcbiAgICAgIGhlaWdodDogMjBcbiAgICB9LFxuICAgIHVuYWxsb2NhdGVkIDoge1xuICAgICAgZmlsbENvbG9yICAgOiBcIiNmZmZmZmZcIixcbiAgICAgIGNvbG9yICAgICAgIDogXCIjMzMzMzMzXCIsXG4gICAgICB3ZWlnaHQgICAgICA6IDEsXG4gICAgICBvcGFjaXR5ICAgICA6IDEsXG4gICAgICBmaWxsT3BhY2l0eSA6IDAuMyxcblx0XHRcdHNpZGVzIDogMyxcblx0XHRcdHJvdGF0ZSA6IDkwLFxuICAgICAgd2lkdGg6IDIwLFxuICAgICAgaGVpZ2h0OiAyMFxuICAgIH1cbiAgfSxcbiAgYXBwbGljYXRpb24gOiB7XG4gICAgYWxsb2NhdGVkIDoge1xuICAgICAgZmlsbENvbG9yICAgOiBcIiMyNTI1QzlcIixcbiAgICAgIGNvbG9yICAgICAgIDogXCIjMzMzMzMzXCIsXG4gICAgICB3ZWlnaHQgICAgICA6IDEsXG4gICAgICBvcGFjaXR5ICAgICA6IDEsXG4gICAgICBmaWxsT3BhY2l0eSA6IDAuMyxcbiAgICAgIHNpZGVzICAgICAgIDogNCxcbiAgICAgIHJvdGF0ZSAgICAgIDogNDUsXG4gICAgICB3aWR0aDogMjAsXG4gICAgICBoZWlnaHQ6IDIwXG4gICAgfSxcbiAgICB1bmFsbG9jYXRlZCA6IHtcbiAgICAgIGZpbGxDb2xvciAgIDogXCIjZmZmZmZmXCIsXG4gICAgICBjb2xvciAgICAgICA6IFwiIzMzMzMzM1wiLFxuICAgICAgd2VpZ2h0ICAgICAgOiAxLFxuICAgICAgb3BhY2l0eSAgICAgOiAxLFxuICAgICAgZmlsbE9wYWNpdHkgOiAwLjMsXG4gICAgICBzaWRlcyAgICAgICA6IDQsXG4gICAgICByb3RhdGUgICAgICA6IDQ1LFxuICAgICAgd2lkdGg6IDIwLFxuICAgICAgaGVpZ2h0OiAyMFxuICAgIH1cbiAgfSxcbiAgbm9EZW1hbmQgOiB7XG4gICAgbm9GaWxsIDogdHJ1ZSxcbiAgICAvL3NpZGVzIDogMCxcbiAgICBjb2xvciA6IFwiIzMzMzMzM1wiLFxuICAgIHN0cmlrZXRocm91Z2ggOiB0cnVlLFxuICAgIHJhZGl1cyA6IDUsXG4gICAgaGVpZ2h0IDogMTIsXG4gICAgd2lkdGggOiAxMlxuICB9XG59O1xubW9kdWxlLmV4cG9ydHMuZGVmYXVsdHMgPSBtYXJrZXJzO1xuXG5tb2R1bGUuZXhwb3J0cy5wZXJjZW50RGVtYW5kID0gZnVuY3Rpb24ob3B0aW9ucywgcGVyY2VudCwgbm9EZW1hbmQpIHtcbiAgaWYoIG5vRGVtYW5kICkge1xuICAgICAkLmV4dGVuZCh0cnVlLCBvcHRpb25zLCBtYXJrZXJzLm5vRGVtYW5kKTtcbiAgICAgcmV0dXJuO1xuICB9XG5cbiAgdmFyIG87XG5cbiAgaWYoIGdsb2JhbC5zZXR0aW5ncy5yZW5kZXJEZW1hbmQgPT0gJ2ZpbGxlZCcgKSB7XG5cbiAgICBpZiggcGVyY2VudCA8PSAwICkge1xuICAgICAgb3B0aW9ucy5maWxsQ29sb3IgPSAnIzMzMyc7XG4gICAgICBvcHRpb25zLmZpbGxPcGFjaXR5ID0gMC4zO1xuICAgIH0gZWxzZSB7XG4gICAgICBvID0gcGVyY2VudDtcbiAgICAgIGlmKCBvID4gMSApIG8gPSAxO1xuICAgICAgb3B0aW9ucy5maWxsT3BhY2l0eSA9IG87XG4gICAgICBvcHRpb25zLmZpbGxDb2xvciA9ICcjMDAwMGZmJztcbiAgICB9XG5cbiAgfSBlbHNlIHtcblxuICAgIGlmKCBwZXJjZW50ID49IDEgKSB7XG4gICAgICBvcHRpb25zLmZpbGxDb2xvciA9ICcjMzMzJztcbiAgICAgIG9wdGlvbnMuZmlsbE9wYWNpdHkgPSAwLjM7XG4gICAgfSBlbHNlIHtcbiAgICAgIG8gPSAxIC0gcGVyY2VudDtcbiAgICAgIGlmKCBvID4gMSApIG8gPSAxO1xuICAgICAgaWYoIG8gPCAwICkgbyA9IDA7XG5cbiAgICAgIG9wdGlvbnMuZmlsbE9wYWNpdHkgPSBvO1xuICAgICAgb3B0aW9ucy5maWxsQ29sb3IgPSAnI2ZmMDAwMCc7XG4gICAgfVxuXG4gIH1cbiAgLy9vcHRpb25zLmZpbGxDb2xvciA9ICcjJytnZXRDb2xvcihhbGxvY2F0aW9uIC8gZGVtYW5kKTtcbn07XG5cbm1vZHVsZS5leHBvcnRzLnBlcmNlbnREZW1hbmRIdWMgPSBmdW5jdGlvbihwZXJjZW50KSB7XG4gIGlmKCBwZXJjZW50ID09IC0xICkge1xuICAgICByZXR1cm4ge1xuICAgICAgIGZpbGxDb2xvciA6ICcjZmZmZmZmJyxcbiAgICAgICBmaWxsT3BhY2l0eSA6IDAuMixcbiAgICAgICB3ZWlnaHQgOiAxLFxuICAgICAgIGNvbG9yOiAnIzMzMzMzMydcbiAgICAgfTtcbiAgfVxuXG5cbiAgaWYoIGdsb2JhbC5zZXR0aW5ncy5yZW5kZXJEZW1hbmQgPT0gJ2ZpbGxlZCcgKSB7XG5cbiAgICBpZiggcGVyY2VudCA8PSAwICkge1xuXG4gICAgICByZXR1cm4ge1xuICAgICAgICBmaWxsQ29sb3IgOiAnIzMzMzMzMycsXG4gICAgICAgIGZpbGxPcGFjaXR5IDogMC4zLFxuICAgICAgICB3ZWlnaHQgOiAyLFxuICAgICAgICBjb2xvcjogJyMzMzMzMzMnXG4gICAgICB9O1xuXG5cbiAgICB9IGVsc2Uge1xuICAgICAgdmFyIG8gPSBwZXJjZW50O1xuICAgICAgaWYoIG8gPiAwLjggKSBvID0gMC44O1xuXG4gICAgICByZXR1cm4ge1xuICAgICAgICBmaWxsQ29sb3IgOiAnIzAwMDBmZicsXG4gICAgICAgIGZpbGxPcGFjaXR5IDogbyxcbiAgICAgICAgd2VpZ2h0IDogMixcbiAgICAgICAgY29sb3I6ICcjMzMzMzMzJ1xuICAgICAgfTtcbiAgICB9XG5cbiAgfSBlbHNlIHtcblxuICAgIGlmKCBwZXJjZW50ID49IDEgKSB7XG5cbiAgICAgIHJldHVybiB7XG4gICAgICAgIGZpbGxDb2xvciA6ICcjMzMzMzMzJyxcbiAgICAgICAgZmlsbE9wYWNpdHkgOiAwLjMsXG4gICAgICAgIHdlaWdodCA6IDIsXG4gICAgICAgIGNvbG9yOiAnIzMzMzMzMydcbiAgICAgIH07XG5cbiAgICB9IGVsc2Uge1xuICAgICAgdmFyIG8gPSAxIC0gcGVyY2VudDtcbiAgICAgIGlmKCBvID4gMC44ICkgbyA9IDAuODtcbiAgICAgIGlmKCBvIDwgMCApIG8gPSAwO1xuXG4gICAgICByZXR1cm4ge1xuICAgICAgICBmaWxsQ29sb3IgOiAnI2ZmMDAwMCcsXG4gICAgICAgIGZpbGxPcGFjaXR5IDogbyxcbiAgICAgICAgd2VpZ2h0IDogMixcbiAgICAgICAgY29sb3I6ICcjMzMzMzMzJ1xuICAgICAgfTtcblxuICAgIH1cblxuICB9XG4gIC8vb3B0aW9ucy5maWxsQ29sb3IgPSAnIycrZ2V0Q29sb3IoYWxsb2NhdGlvbiAvIGRlbWFuZCk7XG59O1xuIiwidmFyIEljb25SZW5kZXJlciA9IHJlcXVpcmUoJy4vaWNvblJlbmRlcmVyJyk7XG5cbm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24oY29uZmlnKSB7XG4gIHRoaXMuY29uZmlnID0gY29uZmlnO1xuICB0aGlzLmVsZSA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2NhbnZhcycpO1xuXG4gIHRoaXMucmVkcmF3ID0gZnVuY3Rpb24oKSB7XG4gICAgdmFyIHcgPSBjb25maWcuaGVpZ2h0IHx8IDMyO1xuICAgIHZhciBoID0gY29uZmlnLndpZHRoIHx8IDMyO1xuXG4gICAgdGhpcy5lbGUuaGVpZ2h0ID0gaDtcbiAgICB0aGlzLmVsZS53aWR0aCA9IHc7XG5cbiAgICB2YXIgY3R4ID0gdGhpcy5lbGUuZ2V0Q29udGV4dChcIjJkXCIpO1xuICAgIGN0eC5jbGVhclJlY3QoMCwgMCwgdywgaCk7XG5cbiAgICBJY29uUmVuZGVyZXIoY3R4LCBjb25maWcpO1xuICB9O1xuXG4gIHRoaXMucmVkcmF3KCk7XG59O1xuIiwidmFyIHV0aWwgPSByZXF1aXJlKCcuL3V0aWxzJyk7XG5cbm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24oY3R4LCBjb25maWcpIHtcblxuICB2YXIgc2lkZXMgPSBjb25maWcuc2lkZXMgIT09IG51bGwgPyBjb25maWcuc2lkZXMgOiA2O1xuICB2YXIgcm90YXRlID0gY29uZmlnLnJvdGF0ZSA/IGNvbmZpZy5yb3RhdGUgOiAwO1xuICB2YXIgeCA9IGNvbmZpZy53aWR0aCAvIDI7XG4gIHZhciB5ID0gY29uZmlnLmhlaWdodCAvIDI7XG5cbiAgdmFyIGEgPSAoKE1hdGguUEkgKiAyKSAvIGNvbmZpZy5zaWRlcyk7XG4gIHZhciByID0gcm90YXRlICogKE1hdGguUEkgLyAxODApO1xuXG4gIHZhciByYWRpdXMgPSAoY29uZmlnLndpZHRoIC8gMikgLSAxO1xuXG4gIHZhciBmaWxsU3R5bGUgPSB1dGlsLmhleFRvUmdiKGNvbmZpZy5maWxsQ29sb3IpO1xuICBmaWxsU3R5bGUucHVzaChjb25maWcuZmlsbE9wYWNpdHkpO1xuICBjdHguZmlsbFN0eWxlID0gJ3JnYmEoJytmaWxsU3R5bGUuam9pbignLCcpKycpJztcblxuICBjdHguc3Ryb2tlU3R5bGUgPSBjb25maWcuY29sb3I7XG5cbiAgLy8gdGhpbmsgeW91IG5lZWQgdG8gYWRqdXN0IGJ5IHgsIHlcbiAgY3R4LmJlZ2luUGF0aCgpO1xuXG4gIC8vIGRyYXcgY2lyY2xlXG4gIGlmICggc2lkZXMgPCAzICkge1xuXG4gICAgY3R4LmFyYyh4LCB5LCByYWRpdXMsIDAsIDIqTWF0aC5QSSk7XG5cbiAgfSBlbHNlIHtcblxuICAgIHZhciB0eCwgdHksIGk7XG4gICAgZm9yIChpID0gMDsgaSA8IGNvbmZpZy5zaWRlczsgaSsrKSB7XG4gICAgICB0eCA9IHggKyAocmFkaXVzICogTWF0aC5jb3MoYSppLXIpKTtcbiAgICAgIHR5ID0geSArIChyYWRpdXMgKiBNYXRoLnNpbihhKmktcikpO1xuXG4gICAgICBpZiggaSA9PT0gMCApIGN0eC5tb3ZlVG8odHgsIHR5KTtcbiAgICAgIGVsc2UgY3R4LmxpbmVUbyh0eCwgdHkpO1xuICAgIH1cbiAgICBjdHgubGluZVRvKHggKyAocmFkaXVzICogTWF0aC5jb3MoLTEgKiByKSksIHkgKyAocmFkaXVzICogTWF0aC5zaW4oLTEgKiByKSkpO1xuICB9XG5cbiAgaWYoICFjb25maWcubm9GaWxsICkgY3R4LmZpbGwoKTtcbiAgY3R4LnN0cm9rZSgpO1xuXG4gIGlmKCBjb25maWcuc3RyaWtldGhyb3VnaCApIHtcbiAgICBjdHguYmVnaW5QYXRoKCk7XG4gICAgY3R4Lm1vdmVUbygxLDEpO1xuICAgIGN0eC5saW5lVG8oKHgqMikgLSAxLCAoeSoyKSAtIDEpO1xuICAgIGN0eC5zdHJva2UoKTtcbiAgfVxufVxuIiwibW9kdWxlLmV4cG9ydHMuaGV4VG9SZ2IgPSBmdW5jdGlvbihoZXgpIHtcbiAgICB2YXIgcmVzdWx0ID0gL14jPyhbYS1mXFxkXXsyfSkoW2EtZlxcZF17Mn0pKFthLWZcXGRdezJ9KSQvaS5leGVjKGhleCk7XG4gICAgcmV0dXJuIHJlc3VsdCA/IFtcbiAgICAgICAgcGFyc2VJbnQocmVzdWx0WzFdLCAxNiksXG4gICAgICAgIHBhcnNlSW50KHJlc3VsdFsyXSwgMTYpLFxuICAgICAgICBwYXJzZUludChyZXN1bHRbM10sIDE2KVxuICAgIF0gOiBbMCwwLDBdO1xufTtcblxubW9kdWxlLmV4cG9ydHMuZ2V0Q29sb3IgPSBmdW5jdGlvbihudW0pIHtcbiAgaWYoIG51bSA+IDEgKSBudW0gPSAxO1xuICBpZiggbnVtIDwgMCApIG51bSA9IDA7XG5cbiAgdmFyIHNwcmVhZCA9IE1hdGguZmxvb3IoNTEwKm51bSkgLSAyNTU7XG5cbiAgaWYoIHNwcmVhZCA8IDAgKSByZXR1cm4gXCJmZjAwXCIrdG9IZXgoMjU1K3NwcmVhZCk7XG4gIGVsc2UgaWYoIHNwcmVhZCA+IDAgKSByZXR1cm4gdG9IZXgoMjU1LXNwcmVhZCkrXCIwMGZmXCI7XG4gIGVsc2UgcmV0dXJuIFwiZmZmZjAwXCI7XG59O1xuXG5tb2R1bGUuZXhwb3J0cy50b0hleCA9IGZ1bmN0aW9uKG51bSkge1xuICBudW0gPSBudW0udG9TdHJpbmcoMTYpO1xuICBpZiggbnVtLmxlbmd0aCA9PSAxICkgbnVtID0gXCIwXCIrbnVtO1xuICByZXR1cm4gbnVtO1xufTtcbiJdfQ==
