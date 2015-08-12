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

// names DWR keeps using though we discussed otherwise...
var previousAttrMap = {
  'application_number' : 'AppID',
  'demand_date' : 'Pull Date',
  'priority_date': 'File Date'
};

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
module.exports.onFileParsed = onFileParsed;

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
        if( previousAttrMap[key] && flatten.indexOf(previousAttrMap[key].toLowerCase()) > -1 ) {
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

    $('#file-modal').modal('hide');

    if( requiredMismatches.length == 0 ) return callback(previousAttrMap);

    // make sure modal is showing
    $('#match-modal').modal('show');

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
            $('#match-modal').modal('hide');
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

    //legend.select(null);
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

var lookupUrl = 'http://atlas.cws.ucdavis.edu/arcgis/rest/services/Watersheds/MapServer/0/query?';
var lookupParams = {
    where : '',
    geometryType : 'esriGeometryEnvelope',
    spatialRel : 'esriSpatialRelIntersects',
    outFields : '*',
    returnGeometry : 'true',
    outSR : '4326',
    f : 'pjson'
};

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

  var params = $.extend(true, {}, lookupParams);
  params.where = 'HUC_12 = \''+hucId+'\'';
  var paramText = [];
  for( var key in params ) {
    paramText.push(key+'='+encodeURIComponent(params[key]));
  }
  $.get(lookupUrl+paramText.join('&'), onLookupResponse);

  /*var query = new google.visualization.Query(urlPrefix+hucId+urlPostix);
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
  });*/
}

function onLookupResponse(resp) {
  if( typeof resp === 'string' ) {
    resp = JSON.parse(resp);
  }

  if( resp.features && resp.features.length > 0 ) {
    var feature = resp.features[0];


    var geojson = {
      'type': 'Feature',
      'properties': feature.attributes,
      'geometry': {
        type : 'Polygon',
        coordinates : feature.geometry.rings
      }
    };

    geojson.properties.id = geojson.properties.HUC_12;

    hucCache[geojson.properties.id] = geojson;

    renderHuc(geojson.properties.id);
  }
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

function getCache() {
  return hucCache;
}

module.exports = {
  init : init,
  render : render,
  clear : clear,
  getCache : getCache
};

},{"../markers/config":16}],7:[function(require,module,exports){
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
  var config = {
    datastore : datastore,
    map : map,
    huc : huc
  };

  map.init(config);
  huc.init(config);
  file.init(config);
  directory.init(config);

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

},{"./datastore":1,"./file":2,"./huc":6,"./leaflet":10,"./library":13,"./map":15}],8:[function(require,module,exports){
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

},{"../markers/iconRenderer":18}],9:[function(require,module,exports){
var IconRenderer = require('../markers/iconRenderer');

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
  };

  return marker;
};

},{"../markers/iconRenderer":18}],10:[function(require,module,exports){
require('./canvas');
require('./dwrat');

},{"./canvas":8,"./dwrat":9}],11:[function(require,module,exports){
(function (global){
var DroughtIcon = require('../markers/droughtIcon');
var markerConfig = require('../markers/config');
var markerTemplate = require('./template');
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

module.exports.stamp = function(data) {
  var template = markerTemplate;
  for( var key in data ) template = template.replace('{{'+key+'}}', data[key]);
  return template;
};

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})

},{"../markers/config":16,"../markers/droughtIcon":17,"./template":12}],12:[function(require,module,exports){
module.exports = 
  '<div class="spacer"></div>'+
  '<h3>Water Right/Claim #: {{application_number}}</h3>'+
  '<div style="margin:15px">'+
    '<b>For:</b> {{date}}<br />'+
    '<b>Allocation:</b> {{allocation}} [Ac-ft/day]<br />'+
    '<b>Demand:</b> {{demand}} [Ac-ft/day]'+
    '<br /><b>Percent of Demand: </b>{{ratio}}%<br />'+
    '<div class="well well-sm" style="margin-top:5px">'+
    '{{water_right_type}}<br />'+
    '<b>Priority Date:</b> {{priority_date}}'+
    '</div>'+
  '</div>';

},{}],13:[function(require,module,exports){
var files = [];

var root = 'https://docs.google.com/spreadsheets/d/1ACi7P0pOy-JRjtw6HribQphhEOZ-0-CkQ_mqnyCfJcI/gviz/tq';
var popup, body, file, map;

function init(config) {
  file = config.file;
  map = config.map;

  var query = new google.visualization.Query(root);
  query.send(onInitLoad);

  popup = $('#directory-modal').modal({show: false});
  body = $('#directory-modal-body');

  $('#directory-btn').on('click', function(){
    popup.modal('show');
  });
}

function onInitLoad(resp) {
  if (resp.isError()) {
    alert('Error in loading public directory listing: ' + response.getMessage() + ' ' + response.getDetailedMessage());
    return;
  }

  var data = resp.getDataTable();
  var rowLen = data.getNumberOfRows();
  var colLen = data.getNumberOfColumns();

  var table = '<h4>Select File to Load</h4><table class="table">';
  for( var i = 0; i < rowLen; i++ ) {
    var file = {};
    for( var j = 0; j < colLen; j++ ) {
      file[data.getColumnLabel(j)] = data.getValue(i, j);
    }

    table += fileToRow(file, i);

    files.push(file);
  }

  body
    .html(table+'</table>')
    .find('a')
    .on('click', function(){
      var file = files[parseInt($(this).attr('index'))];
      load(file.Region, file.ID);
      popup.modal('hide');
    });
}

function load(name, id) {
  var query = new google.visualization.Query('https://docs.google.com/spreadsheets/d/'+id+'/gviz/tq');
  query.send(function(resp){
    if (resp.isError()) {
      alert('Error in loading public sheet: ' + response.getMessage() + ' ' + response.getDetailedMessage());
      return;
    }

    var data = resp.getDataTable();
    var rowLen = data.getNumberOfRows();
    var colLen = data.getNumberOfColumns();
    var csv = [[]];


    for( var i = 0; i < colLen; i++ ) {
      csv[0].push(data.getColumnLabel(i));
    }

    for( var i = 0; i < rowLen; i++ ) {
      var row = [];
      for( var j = 0; j < colLen; j++ ) {
        row.push(data.getValue(i, j));
      }
      csv.push(row);
    }

    file.process.setFilename(name);
    file.process.onFileParsed(null, csv);
  });
}

function fileToRow(file, index) {
  return '<tr>' +
    '<td><a class="btn btn-link" index="'+index+'"><i class="fa fa-download"></i> '+file.Region+'</a></td>'+
    '<td>'+file['Start Date'].toDateString()+'</td>'+
    '<td>'+file['End Date'].toDateString()+'</td>'+
  '</tr>';
}

module.exports = {
  init : init
};

},{}],14:[function(require,module,exports){
var markerConfig = require('../markers/config');
var markerSelector = require('../markers');
var markers = markerConfig.defaults;

var geoJsonLayer;
var map, huc, datastore, mapModule;

module.exports.init = function(config) {
  mapModule = config.map;
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

    markerSelector.select(e.layer);

    var ll = e.layer.feature.geometry.coordinates;

    var t, html = '';
    var allData = datastore.getFeatures();
    for( var i = 0; i < allData.length; i++ ) {
      t = allData[i].feature.geometry.coordinates;
      if( ll[0].toFixed(4) == t[0].toFixed(4) && ll[1].toFixed(4) == t[1].toFixed(4) ) {
        var p = allData[i].feature.properties;

        html += mapModule.legend.stamp({
          application_number : p.application_number,
          date : getDate(p.allocations[0].date),
          allocation : p.allocations[0].allocation,
          demand : p.allocations[0].demand,
          ratio : p.allocations[0].ratio !== null ? (p.allocations[0].ratio*100).toFixed(2) : '100',
          water_right_type : p['Right Type'] || p.riparian,
          priority_date : getDate(p.priority_date)
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

function getDate(d) {
  if( d === undefined ) return 'Unknown';
  if( typeof d === 'string' ) return d;
  return d.toDateString();
}

module.exports.clearLayer = function() {
  if( geoJsonLayer ) map.removeLayer(geoJsonLayer);
};

},{"../markers":19,"../markers/config":16}],15:[function(require,module,exports){
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

  /*var wms2 = L.tileLayer.wms("https://mapsengine.google.com/15542600734275549444-11853667273131550346-4/wms/?version=1.3.0", {
      layers: '15542600734275549444-16143158689603361093-4',
      format: 'image/png',
      transparent: true,
      attribution: "",
      bounds : L.latLngBounds(
        L.latLng(42.00943198804058, -114.1307597213407),
        L.latLng(32.53426345367493, -124.40971171678298)
      )
  });*/
  var wms2 = L.tileLayer.wms("http://atlas.cws.ucdavis.edu/arcgis/services/Watersheds/MapServer/WMSServer", {
      layers: '0',
      format: 'image/png',
      transparent: true,
      attribution: "",
      bounds : L.latLngBounds(
        L.latLng(43.353144, -113.058443),
        L.latLng(32.044528, -124.718638)
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

},{"../legend":11,"./geojson":14}],16:[function(require,module,exports){
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

},{}],17:[function(require,module,exports){
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

},{"./iconRenderer":18}],18:[function(require,module,exports){
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

},{"./utils":20}],19:[function(require,module,exports){
var selected = null;

module.exports.select = function(marker) {
  if( selected !== null ) {
    selected.setStyle({
      color : '#333',
      weight : 1
    });
    if( selected.redraw ) selected.redraw();
  }

  if( marker ) {
    marker.setStyle({
      color : '#ff0000',
      weight : 2
    });
    if( marker.redraw ) marker.redraw();
  }

  selected = marker;
};

},{}],20:[function(require,module,exports){
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
//# sourceMappingURL=data:application/json;charset:utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9ncnVudC1icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJsaWIvc2hhcmVkL2RhdGFzdG9yZS9pbmRleC5qcyIsImxpYi9zaGFyZWQvZmlsZS9pbmRleC5qcyIsImxpYi9zaGFyZWQvZmlsZS9wYXJzZS5qcyIsImxpYi9zaGFyZWQvZmlsZS9wcm9jZXNzLmpzIiwibGliL3NoYXJlZC9maWxlL3NldHVwLmpzIiwibGliL3NoYXJlZC9odWMvaW5kZXguanMiLCJsaWIvc2hhcmVkL2luZGV4LmpzIiwibGliL3NoYXJlZC9sZWFmbGV0L2NhbnZhcy5qcyIsImxpYi9zaGFyZWQvbGVhZmxldC9kd3JhdC5qcyIsImxpYi9zaGFyZWQvbGVhZmxldC9pbmRleC5qcyIsImxpYi9zaGFyZWQvbGVnZW5kL2luZGV4LmpzIiwibGliL3NoYXJlZC9sZWdlbmQvdGVtcGxhdGUuanMiLCJsaWIvc2hhcmVkL2xpYnJhcnkvaW5kZXguanMiLCJsaWIvc2hhcmVkL21hcC9nZW9qc29uLmpzIiwibGliL3NoYXJlZC9tYXAvaW5kZXguanMiLCJsaWIvc2hhcmVkL21hcmtlcnMvY29uZmlnLmpzIiwibGliL3NoYXJlZC9tYXJrZXJzL2Ryb3VnaHRJY29uLmpzIiwibGliL3NoYXJlZC9tYXJrZXJzL2ljb25SZW5kZXJlci5qcyIsImxpYi9zaGFyZWQvbWFya2Vycy9pbmRleC5qcyIsImxpYi9zaGFyZWQvbWFya2Vycy91dGlscy5qcyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTtBQ0FBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3BDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3RLQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDcEVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDektBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDeENBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2hNQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzFEQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDbkNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDdEJBO0FBQ0E7QUFDQTs7O0FDRkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7Ozs7QUN2SUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNiQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzlGQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM3SUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOzs7QUMxRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7Ozs7QUNsS0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDckJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ25EQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNyQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSIsImZpbGUiOiJnZW5lcmF0ZWQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlc0NvbnRlbnQiOlsiKGZ1bmN0aW9uIGUodCxuLHIpe2Z1bmN0aW9uIHMobyx1KXtpZighbltvXSl7aWYoIXRbb10pe3ZhciBhPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7aWYoIXUmJmEpcmV0dXJuIGEobywhMCk7aWYoaSlyZXR1cm4gaShvLCEwKTt2YXIgZj1uZXcgRXJyb3IoXCJDYW5ub3QgZmluZCBtb2R1bGUgJ1wiK28rXCInXCIpO3Rocm93IGYuY29kZT1cIk1PRFVMRV9OT1RfRk9VTkRcIixmfXZhciBsPW5bb109e2V4cG9ydHM6e319O3Rbb11bMF0uY2FsbChsLmV4cG9ydHMsZnVuY3Rpb24oZSl7dmFyIG49dFtvXVsxXVtlXTtyZXR1cm4gcyhuP246ZSl9LGwsbC5leHBvcnRzLGUsdCxuLHIpfXJldHVybiBuW29dLmV4cG9ydHN9dmFyIGk9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtmb3IodmFyIG89MDtvPHIubGVuZ3RoO28rKylzKHJbb10pO3JldHVybiBzfSkiLCJ2YXIgZGF0YSA9IHtcbiAgYWxsIDogW10sXG4gIG5vRGVtYW5kIDogW10sXG4gIGZlYXR1cmVzIDogW11cbn07XG5cbm1vZHVsZS5leHBvcnRzLnNldCA9IGZ1bmN0aW9uKHBvaW50cykge1xuICBkYXRhLmFsbCA9IHBvaW50cztcblxuICB0bXAgPSBbXTtcbiAgZm9yKCB2YXIgaSA9IHBvaW50cy5sZW5ndGgtMTsgaSA+PSAwOyBpLS0gKSB7XG4gICAgaWYoIHBvaW50c1tpXS5wcm9wZXJ0aWVzLmFsbG9jYXRpb25zICYmIHBvaW50c1tpXS5wcm9wZXJ0aWVzLmFsbG9jYXRpb25zLmxlbmd0aCA+IDAgKSB7XG5cbiAgICAgIHZhciBkZW1hbmQgPSBwb2ludHNbaV0ucHJvcGVydGllcy5hbGxvY2F0aW9uc1swXS5kZW1hbmQ7XG4gICAgICBpZiggZGVtYW5kICE9PSAwICkgdG1wLnB1c2gocG9pbnRzW2ldKTtcbiAgICB9XG4gIH1cbiAgZGF0YS5ub0RlbWFuZCA9IHRtcDtcbn07XG5cbm1vZHVsZS5leHBvcnRzLmdldCA9IGZ1bmN0aW9uKG5vRGVtYW5kKSB7XG4gIGlmKCBub0RlbWFuZCApIHJldHVybiBkYXRhLm5vRGVtYW5kO1xuICByZXR1cm4gZGF0YS5hbGw7XG59O1xuXG5tb2R1bGUuZXhwb3J0cy5jbGVhckZlYXR1cmVzID0gZnVuY3Rpb24oKXtcbiAgZGF0YS5mZWF0dXJlcyA9IFtdO1xufTtcblxubW9kdWxlLmV4cG9ydHMuYWRkRmVhdHVyZSA9IGZ1bmN0aW9uKGZlYXR1cmUpIHtcbiAgZGF0YS5mZWF0dXJlcy5wdXNoKGZlYXR1cmUpO1xufTtcblxubW9kdWxlLmV4cG9ydHMuZ2V0RmVhdHVyZXMgPSBmdW5jdGlvbigpIHtcbiAgcmV0dXJuIGRhdGEuZmVhdHVyZXM7XG59O1xuIiwidmFyIHByb2Nlc3MgPSByZXF1aXJlKCcuL3Byb2Nlc3MnKTtcblxudmFyIEhFQURFUlMgPSB7XG4gICAgYXBwbGljYXRpb25fbnVtYmVyIDoge1xuICAgICAgICByZXF1aXJlZCA6IHRydWUsXG4gICAgICAgIHR5cGUgOiAnc3RyaW5nJ1xuICAgIH0sXG4gICAgZGVtYW5kX2RhdGUgOiB7XG4gICAgICAgIHJlcXVpcmVkIDogdHJ1ZSxcbiAgICAgICAgdHlwZSA6ICdkYXRlLXN0cmluZydcbiAgICB9LFxuICAgIHdhdGVyc2hlZCA6IHtcbiAgICAgICAgcmVxdWlyZWQgOiBmYWxzZSxcbiAgICAgICAgdHlwZSA6ICdzdHJpbmcnXG4gICAgfSxcbiAgICBzZWFzb24gOiB7XG4gICAgICAgIHJlcXVpcmVkIDogZmFsc2UsXG4gICAgICAgIHR5cGUgOiAnYm9vbGVhbicsXG4gICAgfSxcbiAgICAnaHVjLTEyJyA6IHtcbiAgICAgICAgcmVxdWlyZWQgOiBmYWxzZSxcbiAgICAgICAgdHlwZSA6ICdib29sZWFuJ1xuICAgIH0sXG4gICAgd2F0ZXJfcmlnaHRfdHlwZSA6IHtcbiAgICAgICAgcmVxdWlyZWQgOiBmYWxzZSxcbiAgICAgICAgdHlwZSA6ICdzdHJpbmcnXG4gICAgfSxcbiAgICBwcmlvcml0eV9kYXRlIDoge1xuICAgICAgICByZXF1aXJlZCA6IHRydWUsXG4gICAgICAgIHR5cGUgOiAnZGF0ZS1zdHJpbmcnXG4gICAgfSxcbiAgICByaXBhcmlhbiA6IHtcbiAgICAgICAgcmVxdWlyZWQgOiBmYWxzZSxcbiAgICAgICAgdHlwZSA6ICdib29sZWFuJ1xuICAgIH0sXG4gICAgcHJlMTkxNCA6IHtcbiAgICAgICAgcmVxdWlyZWQgOiBmYWxzZSxcbiAgICAgICAgdHlwZSA6ICdib29sZWFuJ1xuICAgIH0sXG4gICAgZGVtYW5kIDoge1xuICAgICAgICByZXF1aXJlZCA6IHRydWUsXG4gICAgICAgIHR5cGUgOiAnZmxvYXQnXG4gICAgfSxcbiAgICBhbGxvY2F0aW9uIDoge1xuICAgICAgICByZXF1aXJlZCA6IHRydWUsXG4gICAgICAgIHR5cGUgOiAnZmxvYXQnXG4gICAgfVxufTtcblxudmFyIGxvY2F0aW9ucyA9IHt9LCBtYXAsIGRhdGFzdG9yZTtcblxuXG5mdW5jdGlvbiBjcmVhdGVHZW9Kc29uKGRhdGEsIGF0dHJNYXAsIGNhbGxiYWNrKSB7XG4gICAgLy8gZmlyc3QgbG9jYXRlIGRhdGFcbiAgICAkKCcjZmlsZS1sb2NhdGUnKS5odG1sKCdMb2NhdGluZyBkYXRhLi4uJyk7XG5cbiAgICB2YXIgaWRzID0gW10sIGtleTtcbiAgICB2YXIgY29sID0gZ2V0QXR0ckNvbCgnYXBwbGljYXRpb25fbnVtYmVyJywgZGF0YSwgYXR0ck1hcCk7XG4gICAgZm9yKCB2YXIgaSA9IDE7IGkgPCBkYXRhLmxlbmd0aDsgaSsrICkge1xuICAgICAgICB2YXIgaWQgPSBkYXRhW2ldW2NvbF07XG4gICAgICAgIGlmKCAhbG9jYXRpb25zW2lkXSApIGlkcy5wdXNoKGRhdGFbaV1bY29sXSk7XG4gICAgfVxuXG4gICAgbG9jYXRlRGF0YSgwLCBpZHMsIGZ1bmN0aW9uKCl7XG5cbiAgICAgICAgJCgnI2ZpbGUtbG9jYXRlJykuaHRtbCgnQ3JlYXRpbmcgZGF0YS4uLicpO1xuXG4gICAgICAgIHZhciBpTWFwID0ge307XG4gICAgICAgIGZvcigga2V5IGluIGF0dHJNYXAgKSBpTWFwW2F0dHJNYXBba2V5XV0gPSBrZXk7XG5cbiAgICAgICAgdmFyIGdlb0pzb24gPSBbXTtcbiAgICAgICAgZm9yKCB2YXIgaSA9IDE7IGkgPCBkYXRhLmxlbmd0aDsgaSsrICkge1xuICAgICAgICAgICAgaWYoICFsb2NhdGlvbnNbZGF0YVtpXVtjb2xdXSApIGNvbnRpbnVlO1xuXG4gICAgICAgICAgICB2YXIgcCA9IHtcbiAgICAgICAgICAgICAgICB0eXBlIDogJ0ZlYXR1cmUnLFxuICAgICAgICAgICAgICAgIGdlb21ldHJ5IDogJC5leHRlbmQoe30sIHRydWUsIGxvY2F0aW9uc1tkYXRhW2ldW2NvbF1dKSxcbiAgICAgICAgICAgICAgICBwcm9wZXJ0aWVzIDoge31cbiAgICAgICAgICAgIH07XG5cbiAgICAgICAgICAgIGZvciggdmFyIGogPSAwOyBqIDwgZGF0YVswXS5sZW5ndGg7IGorKyApIHtcbiAgICAgICAgICAgICAgICBrZXkgPSBkYXRhWzBdW2pdO1xuICAgICAgICAgICAgICAgIGlmKCBpTWFwW2tleV0gKSBrZXkgPSBpTWFwW2tleV07XG4gICAgICAgICAgICAgICAgcC5wcm9wZXJ0aWVzW2tleV0gPSAoSEVBREVSU1trZXldICYmIEhFQURFUlNba2V5XS50eXBlID09ICdmbG9hdCcpID8gcGFyc2VGbG9hdChkYXRhW2ldW2pdKSA6IGRhdGFbaV1bal07XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHAucHJvcGVydGllcy5hbGxvY2F0aW9ucyA9IFt7XG4gICAgICAgICAgICAgICAgc2Vhc29uIDogdHJ1ZSxcbiAgICAgICAgICAgICAgICBhbGxvY2F0aW9uIDogcC5wcm9wZXJ0aWVzLmFsbG9jYXRpb24sXG4gICAgICAgICAgICAgICAgZGVtYW5kIDogcC5wcm9wZXJ0aWVzLmRlbWFuZCxcbiAgICAgICAgICAgICAgICBmb3JlY2FzdCA6IGZhbHNlLFxuICAgICAgICAgICAgICAgIGRhdGUgOiBwLnByb3BlcnRpZXMuZGVtYW5kX2RhdGUsXG4gICAgICAgICAgICAgICAgcHVibGljX2hlYWx0aF9iaW5kIDogZmFsc2UsXG4gICAgICAgICAgICAgICAgd3JiaW5kIDogZmFsc2UsXG4gICAgICAgICAgICAgICAgcmF0aW8gOiAocC5wcm9wZXJ0aWVzLmRlbWFuZCA+IDApID8gKHAucHJvcGVydGllcy5hbGxvY2F0aW9uIC8gcC5wcm9wZXJ0aWVzLmRlbWFuZCkgOiAwXG4gICAgICAgICAgICB9XTtcblxuICAgICAgICAgICAgZ2VvSnNvbi5wdXNoKHApO1xuICAgICAgICB9XG5cbiAgICAgICAgbWFwLmNsZWFyR2VvanNvbkxheWVyKCk7XG4gICAgICAgIGRhdGFzdG9yZS5zZXQoZ2VvSnNvbik7XG4gICAgICAgIG1hcC5nZW9qc29uLmFkZChnZW9Kc29uKTtcblxuICAgICAgICAkKCcjZmlsZS1sb2NhdGUnKS5odG1sKCcnKTtcbiAgICAgICAgY2FsbGJhY2soKTtcbiAgICB9KTtcbn1cblxuZnVuY3Rpb24gZ2V0QXR0ckNvbChhdHRyLCBkYXRhLCBtYXApIHtcbiAgICBpZiggbWFwW2F0dHJdICkgcmV0dXJuIGRhdGFbMF0uaW5kZXhPZihtYXBbYXR0cl0pO1xuICAgIHJldHVybiBkYXRhWzBdLmluZGV4T2YoYXR0cik7XG59XG5cbmZ1bmN0aW9uIGxvY2F0ZURhdGEoaW5kZXgsIGlkcywgY2FsbGJhY2spIHtcbiAgICBpZiggaW5kZXgrMSA+PSBpZHMubGVuZ3RoICkge1xuICAgICAgICBjYWxsYmFjaygpO1xuICAgIH0gZWxzZSB7XG4gICAgICAgIHZhciBpZEdyb3VwID0gW107XG5cbiAgICAgICAgdmFyIGkgPSAwO1xuICAgICAgICBmb3IoIGkgPSBpbmRleDsgaSA8IGluZGV4KzIwMDsgaSsrICkge1xuICAgICAgICAgICAgaWYoIGlkcy5sZW5ndGggPT0gaSApIGJyZWFrO1xuICAgICAgICAgICAgaWRHcm91cC5wdXNoKGlkc1tpXSk7XG4gICAgICAgIH1cbiAgICAgICAgaW5kZXggKz0gMjAwO1xuICAgICAgICBjb25zb2xlLmxvZyhpbmRleCk7XG5cblxuXG4gICAgICAgIHZhciBxdWVyeSA9IG5ldyBnb29nbGUudmlzdWFsaXphdGlvbi5RdWVyeSgnaHR0cDovL3dhdGVyc2hlZC5pY2UudWNkYXZpcy5lZHUvdml6c291cmNlL3Jlc3Q/dmlldz1sb2NhdGUoXFwnJytcbiAgICAgICAgICAgIGlkR3JvdXAuam9pbignLCcpKydcXCcpJnRxPVNFTEVDVCAqJyk7XG4gICAgICAgIHF1ZXJ5LnNlbmQoZnVuY3Rpb24ocmVzcCl7XG4gICAgICAgICAgICBpZiggcmVzcC5pc0Vycm9yKCkgKSB7XG4gICAgICAgICAgICAgICAgY29uc29sZS5sb2cocmVzcC5nZXRNZXNzYWdlKCkpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICB2YXIgZHQgPSByZXNwLmdldERhdGFUYWJsZSgpO1xuICAgICAgICAgICAgICAgIGZvciggdmFyIGkgPSAwOyBpIDwgZHQuZ2V0TnVtYmVyT2ZSb3dzKCk7IGkrKyApIHtcbiAgICAgICAgICAgICAgICAgICAgbG9jYXRpb25zW2R0LmdldFZhbHVlKGksIDApXSA9IEpTT04ucGFyc2UoZHQuZ2V0VmFsdWUoaSwgMikpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgJCgnI2ZpbGUtbG9jYXRlJykuaHRtbCgnTG9jYXRpbmcgZGF0YSAnKygoaW5kZXgvaWRzLmxlbmd0aCkudG9GaXhlZCgyKSoxMDApKyclLi4uJyk7XG4gICAgICAgICAgICBsb2NhdGVEYXRhKGluZGV4LCBpZHMsIGNhbGxiYWNrKTtcbiAgICAgICAgfSk7XG4gICAgfVxufVxuXG5cblxudmFyIGZpbGUgPSB7XG4gIEhFQURFUlMgOiBIRUFERVJTLFxuICBpbml0IDogZnVuY3Rpb24ob3B0aW9ucyl7XG4gICAgbWFwID0gb3B0aW9ucy5tYXA7XG4gICAgZGF0YXN0b3JlID0gb3B0aW9ucy5kYXRhc3RvcmU7XG4gICAgb3B0aW9ucy5maWxlID0gdGhpcztcblxuICAgIHJlcXVpcmUoJy4vc2V0dXAnKShwcm9jZXNzKTtcbiAgICBwcm9jZXNzLmluaXQob3B0aW9ucyk7XG4gIH0sXG4gIGNyZWF0ZUdlb0pzb24gOiBjcmVhdGVHZW9Kc29uLFxuICBwcm9jZXNzIDogcHJvY2Vzc1xufTtcblxuXG5tb2R1bGUuZXhwb3J0cyA9IGZpbGU7XG4iLCJtb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uKHR5cGUsIGNvbnRlbnRzLCBjYWxsYmFjaykge1xuICAgIGlmKCB0eXBlID09ICd4bHN4JyApIHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGZ1bmN0aW9uIG9uWGxzeENvbXBsZXRlKHdiKXtcbiAgICAgICAgICAgICAgICBzZWxlY3RXb3Jrc2hlZXQod2IuU2hlZXROYW1lcywgZnVuY3Rpb24oc2hlZXROYW1lKXtcbiAgICAgICAgICAgICAgICAgICAgdmFyIGNzdiA9IFhMU1gudXRpbHMuc2hlZXRfdG9fY3N2KHdiLlNoZWV0c1tzaGVldE5hbWVdKTtcbiAgICAgICAgICAgICAgICAgICAgJC5jc3YudG9BcnJheXMoY3N2LCB7fSwgZnVuY3Rpb24oZXJyLCBkYXRhKXtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmKCBlcnIgKSByZXR1cm4gY2FsbGJhY2soZXJyKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNhbGxiYWNrKG51bGwsIGRhdGEpO1xuICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgdmFyIHdvcmtlciA9IG5ldyBXb3JrZXIoJ2Jvd2VyX2NvbXBvbmVudHMvanMteGxzeC94bHN4d29ya2VyLmpzJyk7XG4gICAgICAgICAgICB3b3JrZXIub25tZXNzYWdlID0gZnVuY3Rpb24oZSkge1xuICAgICAgICAgICAgICAgIHN3aXRjaChlLmRhdGEudCkge1xuICAgICAgICAgICAgICAgICAgICBjYXNlICdyZWFkeSc6IGJyZWFrO1xuICAgICAgICAgICAgICAgICAgICBjYXNlICdlJzogY29uc29sZS5lcnJvcihlLmRhdGEuZCk7IGJyZWFrO1xuICAgICAgICAgICAgICAgICAgICBjYXNlICd4bHN4Jzogb25YbHN4Q29tcGxldGUoSlNPTi5wYXJzZShlLmRhdGEuZCkpOyBicmVhaztcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9O1xuICAgICAgICAgICAgd29ya2VyLnBvc3RNZXNzYWdlKHtkOmNvbnRlbnRzLGI6dHJ1ZX0pO1xuXG4gICAgICAgIH0gY2F0Y2goZSkge1xuICAgICAgICAgICAgY2FsbGJhY2soZSk7XG4gICAgICAgIH1cblxuICAgIH0gZWxzZSBpZiggaW5mby5leHQgPT0gJ3hscycgKSB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBmdW5jdGlvbiBvblhsc0NvbXBsZXRlKHdiKXtcbiAgICAgICAgICAgICAgICBzZWxlY3RXb3Jrc2hlZXQod2IuU2hlZXROYW1lcywgZnVuY3Rpb24oc2hlZXROYW1lKXtcbiAgICAgICAgICAgICAgICAgICAgdmFyIGNzdiA9IFhMUy51dGlscy5zaGVldF90b19jc3Yod2IuU2hlZXRzW3NoZWV0TmFtZV0pO1xuICAgICAgICAgICAgICAgICAgICAkLmNzdi50b0FycmF5cyhjc3YsIHt9LCBmdW5jdGlvbihlcnIsIGRhdGEpe1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYoIGVyciApIHJldHVybiBjYWxsYmFjayhlcnIpO1xuICAgICAgICAgICAgICAgICAgICAgICAgY2FsbGJhY2sobnVsbCwgZGF0YSk7XG4gICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICB2YXIgd29ya2VyID0gbmV3IFdvcmtlcignYm93ZXJfY29tcG9uZW50cy9qcy14bHMveGxzd29ya2VyLmpzJyk7XG4gICAgICAgICAgICB3b3JrZXIub25tZXNzYWdlID0gZnVuY3Rpb24oZSkge1xuICAgICAgICAgICAgICAgIHN3aXRjaChlLmRhdGEudCkge1xuICAgICAgICAgICAgICAgICAgICBjYXNlICdyZWFkeSc6IGJyZWFrO1xuICAgICAgICAgICAgICAgICAgICBjYXNlICdlJzogY29uc29sZS5lcnJvcihlLmRhdGEuZCk7IGJyZWFrO1xuICAgICAgICAgICAgICAgICAgICBjYXNlICd4bHN4Jzogb25YbHNDb21wbGV0ZShKU09OLnBhcnNlKGUuZGF0YS5kKSk7IGJyZWFrO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH07XG4gICAgICAgICAgICB3b3JrZXIucG9zdE1lc3NhZ2Uoe2Q6Y29udGVudHMsYjp0cnVlfSk7XG5cbiAgICAgICAgfSBjYXRjaChlKSB7XG4gICAgICAgICAgICBkZWJ1Z2dlcjtcbiAgICAgICAgICAgIHRoaXMub25Db21wbGV0ZShlLCBudWxsLCBpbmZvLCAxLCAxLCBhcnIsIGNhbGxiYWNrKTtcbiAgICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICB2YXIgb3B0aW9ucyA9IHt9O1xuICAgICAgICAgICAgLy9pZiggaW5mby5wYXJzZXIgPT0gJ2Nzdi10YWInICkgb3B0aW9ucy5zZXBhcmF0b3IgPSAnXFx0JztcblxuICAgICAgICAgICAgJC5jc3YudG9BcnJheXMoY29udGVudHMsIG9wdGlvbnMsIGZ1bmN0aW9uKGVyciwgZGF0YSl7XG4gICAgICAgICAgICAgICAgaWYoIGVyciApIHJldHVybiBjYWxsYmFjayhlcnIpO1xuICAgICAgICAgICAgICAgIGNhbGxiYWNrKG51bGwsIGRhdGEpO1xuICAgICAgICAgICAgfS5iaW5kKHRoaXMpKTtcbiAgICAgICAgfSBjYXRjaChlKSB7XG4gICAgICAgICAgICBkZWJ1Z2dlcjtcbiAgICAgICAgICAgIHRoaXMub25Db21wbGV0ZShlLCBudWxsLCBpbmZvLCAxLCAxLCBhcnIsIGNhbGxiYWNrKTtcbiAgICAgICAgfVxuICAgIH1cbn1cbiIsInZhciBwYXJzZSA9IHJlcXVpcmUoJy4vcGFyc2UnKTtcblxuLy8gbmFtZXMgRFdSIGtlZXBzIHVzaW5nIHRob3VnaCB3ZSBkaXNjdXNzZWQgb3RoZXJ3aXNlLi4uXG52YXIgcHJldmlvdXNBdHRyTWFwID0ge1xuICAnYXBwbGljYXRpb25fbnVtYmVyJyA6ICdBcHBJRCcsXG4gICdkZW1hbmRfZGF0ZScgOiAnUHVsbCBEYXRlJyxcbiAgJ3ByaW9yaXR5X2RhdGUnOiAnRmlsZSBEYXRlJ1xufTtcblxudmFyIGZpbGUsIG1hcCwgZmlsZW5hbWUgPSAnJywgaHVjO1xuXG5tb2R1bGUuZXhwb3J0cy5pbml0ID0gZnVuY3Rpb24ob3B0aW9ucykge1xuICBmaWxlID0gb3B0aW9ucy5maWxlO1xuICBtYXAgPSBvcHRpb25zLm1hcDtcbiAgaHVjID0gb3B0aW9ucy5odWM7XG59O1xuXG4vLyBwcm9jZXNzIGEgZmlsZVxubW9kdWxlLmV4cG9ydHMucnVuID0gZnVuY3Rpb24oZSkge1xuICBlLnN0b3BQcm9wYWdhdGlvbigpO1xuICBlLnByZXZlbnREZWZhdWx0KCk7XG4gIHZhciBmaWxlcyA9IGUuZGF0YVRyYW5zZmVyID8gZS5kYXRhVHJhbnNmZXIuZmlsZXMgOiBlLnRhcmdldC5maWxlczsgLy8gRmlsZUxpc3Qgb2JqZWN0LlxuXG4gIGlmKCBmaWxlcy5sZW5ndGggPiAwICkge1xuICAgICQoJyNmaWxlLWxvY2F0ZScpLmh0bWwoJ0xvYWRpbmcgZmlsZS4uLicpO1xuICAgIGZpbGVuYW1lID0gZmlsZXNbMF0ubmFtZTtcbiAgICByZWFkKGZpbGVzWzBdKTtcbiAgfVxufTtcblxubW9kdWxlLmV4cG9ydHMuc2V0RmlsZW5hbWUgPSBmdW5jdGlvbihuYW1lKSB7XG4gIGZpbGVuYW1lID0gbmFtZTtcbn07XG5cbmZ1bmN0aW9uIGltcG9ydENvbnRlbnRzKHR5cGUsIGNvbnRlbnRzLCBjYWxsYmFjaykge1xuICBwYXJzZSh0eXBlLCBjb250ZW50cywgb25GaWxlUGFyc2VkKTtcbn1cbm1vZHVsZS5leHBvcnRzLmltcG9ydENvbnRlbnRzID0gaW1wb3J0Q29udGVudHM7XG5cbmZ1bmN0aW9uIG9uRmlsZVBhcnNlZChlcnIsIGRhdGEpIHtcbiAgJCgnI2ZpbGUtbG9jYXRlJykuaHRtbCgnJyk7XG4gIG1hdGNoQ29scyhkYXRhLCBmdW5jdGlvbihjb2xNYXApe1xuXG4gICAgLy8gbm93IGxvY2F0ZSBkYXRhIGFuZCBjcmVhdGVcbiAgICBmaWxlLmNyZWF0ZUdlb0pzb24oZGF0YSwgY29sTWFwLCB1cGRhdGVVaVBvc3RJbXBvcnQpO1xuICB9KTtcbn1cbm1vZHVsZS5leHBvcnRzLm9uRmlsZVBhcnNlZCA9IG9uRmlsZVBhcnNlZDtcblxuZnVuY3Rpb24gdXBkYXRlVWlQb3N0SW1wb3J0KCkge1xuICAkKCcjZGF0ZS1zZWxlY3Rpb24nKS5oaWRlKCk7XG4gICQoJyNmaWxlLXNlbGVjdGlvbicpLmh0bWwoZmlsZW5hbWUrJyA8YSBjbGFzcz1cImJ0biBidG4tZGVmYXVsdFwiIGlkPVwicmVtb3ZlLWZpbGUtYnRuXCI+PGkgY2xhc3M9XCJmYSBmYS10aW1lc1wiPjwvaT48L2E+Jyk7XG5cbiAgJCgnI3JlbW92ZS1maWxlLWJ0bicpLm9uKCdjbGljaycsZnVuY3Rpb24oKXtcbiAgICBtYXAuZ2VvanNvbi5jbGVhckxheWVyKCk7XG4gICAgaHVjLmNsZWFyKCk7XG4gICAgJCgnI2RhdGUtc2VsZWN0aW9uJykuc2hvdygpO1xuICAgICQoJyNmaWxlLXNlbGVjdGlvbicpLmh0bWwoJycpO1xuICB9KTtcblxuICAkKCcjZmlsZS1pbnB1dCcpLnZhbCgnJyk7XG59XG5cbmZ1bmN0aW9uIHJlYWQocmF3KSB7XG4gICAgX3Jlc2V0VUkoKTtcblxuICAgIHZhciB0eXBlID0gJ3RleHQnO1xuXG4gICAgdmFyIHJlYWRlciA9IG5ldyBGaWxlUmVhZGVyKCk7XG4gICAgcmVhZGVyLm9ubG9hZCA9IGZ1bmN0aW9uKGUpIHtcbiAgICAgICAgaW1wb3J0Q29udGVudHModHlwZSwgZS50YXJnZXQucmVzdWx0KTtcbiAgICB9O1xuXG4gICAgaWYoIHJhdy5uYW1lLm1hdGNoKC8uKlxcLnhsc3g/JC8pICkge1xuICAgICAgICB0eXBlID0gcmF3Lm5hbWUucmVwbGFjZSgvLipcXC4vLCcnKTtcbiAgICAgICAgcmVhZGVyLnJlYWRBc0JpbmFyeVN0cmluZyhyYXcpO1xuICAgIH0gZWxzZSB7XG4gICAgICAgIHJlYWRlci5yZWFkQXNUZXh0KHJhdyk7XG4gICAgfVxufVxuXG5mdW5jdGlvbiBtYXRjaENvbHMoZGF0YSwgY2FsbGJhY2spIHtcbiAgICBpZiggZGF0YS5sZW5ndGggPT0gMCApIHJldHVybiBhbGVydCgnWW91ciBmaWxlIGlzIGVtcHR5Jyk7XG5cbiAgICB2YXIgbWF0Y2hlcyA9IFtdO1xuICAgIHZhciByZXF1aXJlZE1pc21hdGNoZXMgPSBbXTtcbiAgICB2YXIgbWFwcGVkID0gcHJldmlvdXNBdHRyTWFwO1xuXG4gICAgdmFyIGZsYXR0ZW4gPSBbXTtcbiAgICBmb3IoIHZhciBpID0gMDsgaSA8IGRhdGFbMF0ubGVuZ3RoOyBpKysgKSB7XG4gICAgICBmbGF0dGVuLnB1c2goZGF0YVswXVtpXS50b0xvd2VyQ2FzZSgpKTtcbiAgICB9XG5cbiAgICBmb3IoIHZhciBrZXkgaW4gZmlsZS5IRUFERVJTICkge1xuICAgICAgICBpZiggcHJldmlvdXNBdHRyTWFwW2tleV0gJiYgZmxhdHRlbi5pbmRleE9mKHByZXZpb3VzQXR0ck1hcFtrZXldLnRvTG93ZXJDYXNlKCkpID4gLTEgKSB7XG4gICAgICAgICAgICBtYXRjaGVzLnB1c2goa2V5KTtcbiAgICAgICAgfSBlbHNlIGlmKCBmbGF0dGVuLmluZGV4T2Yoa2V5LnRvTG93ZXJDYXNlKCkpID09IC0xICYmIGZpbGUuSEVBREVSU1trZXldLnJlcXVpcmVkICkge1xuICAgICAgICAgICAgcmVxdWlyZWRNaXNtYXRjaGVzLnB1c2goa2V5KTtcbiAgICAgICAgfSBlbHNlIGlmKCBmbGF0dGVuLmluZGV4T2Yoa2V5LnRvTG93ZXJDYXNlKCkpID4gLTEgKSB7XG4gICAgICAgICAgaWYoIGRhdGFbMF0uaW5kZXhPZihrZXkpID4gLTEgKSB7XG4gICAgICAgICAgICBtYXRjaGVzLnB1c2goa2V5KTtcbiAgICAgICAgICB9IGVsc2UgeyAvLyB0aGUgY2FzZSBkaWZmZXJzLCBhZGQgaXQgdG8gdGhlIGF0dHJpYnV0ZSBtYXBcbiAgICAgICAgICAgIHZhciBpbmRleCA9IGZsYXR0ZW4uaW5kZXhPZihrZXkudG9Mb3dlckNhc2UoKSk7XG4gICAgICAgICAgICBwcmV2aW91c0F0dHJNYXBba2V5XSA9IGRhdGFbMF1baW5kZXhdO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgICQoJyNmaWxlLW1vZGFsJykubW9kYWwoJ2hpZGUnKTtcblxuICAgIGlmKCByZXF1aXJlZE1pc21hdGNoZXMubGVuZ3RoID09IDAgKSByZXR1cm4gY2FsbGJhY2socHJldmlvdXNBdHRyTWFwKTtcblxuICAgIC8vIG1ha2Ugc3VyZSBtb2RhbCBpcyBzaG93aW5nXG4gICAgJCgnI21hdGNoLW1vZGFsJykubW9kYWwoJ3Nob3cnKTtcblxuICAgIHZhciB0YWJsZSA9ICc8dGFibGUgY2xhc3M9XCJ0YWJsZVwiPic7XG4gICAgZm9yKCB2YXIgaSA9IDA7IGkgPCByZXF1aXJlZE1pc21hdGNoZXMubGVuZ3RoOyBpKysgKSB7XG4gICAgICAgIHRhYmxlICs9ICc8dHI+PHRkPicrcmVxdWlyZWRNaXNtYXRjaGVzW2ldKyc8L3RkPjx0ZD4nK19jcmVhdGVNYXRjaFNlbGVjdG9yKHJlcXVpcmVkTWlzbWF0Y2hlc1tpXSwgZGF0YVswXSwgbWF0Y2hlcykrJzwvdGQ+PC90cj4nO1xuICAgIH1cbiAgICB0YWJsZSArPSAnPC90YWJsZT4nO1xuXG4gICAgJCgnI21hdGNoVGFibGUnKS5odG1sKCc8ZGl2IHN0eWxlPVwibWFyZ2luLXRvcDoyMHB4O2ZvbnQtd2VpZ2h0OmJvbGRcIj5QbGVhc2UgbWF0Y2ggdGhlIGZvbGxvd2luZyByZXF1aXJlZCBjb2x1bW5zIHRvIGNvbnRpbnVlPC9kaXY+Jyt0YWJsZSk7XG4gICAgJCgnLm1hdGNoLXNlbGVjdG9yJykub24oJ2NoYW5nZScsIGZ1bmN0aW9uKCl7XG4gICAgICAgIHZhciBrZXkgPSAkKHRoaXMpLmF0dHIoJ2tleScpO1xuICAgICAgICB2YXIgdmFsID0gJCh0aGlzKS52YWwoKTtcblxuICAgICAgICBpZiggdmFsID09ICcnIHx8ICF2YWwgKSB7XG4gICAgICAgICAgICBkZWxldGUgbWFwcGVkW2tleV07XG4gICAgICAgICAgICByZXF1aXJlZE1pc21hdGNoZXMucHVzaChrZXkpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgbWFwcGVkW2tleV0gPSB2YWw7XG4gICAgICAgICAgICB2YXIgaW5kZXggPSByZXF1aXJlZE1pc21hdGNoZXMuaW5kZXhPZihrZXkpO1xuICAgICAgICAgICAgaWYgKGluZGV4ID4gLTEpIHJlcXVpcmVkTWlzbWF0Y2hlcy5zcGxpY2UoaW5kZXgsIDEpO1xuICAgICAgICB9XG5cblxuICAgICAgICBpZiggcmVxdWlyZWRNaXNtYXRjaGVzLmxlbmd0aCA9PSAwICkge1xuICAgICAgICAgICAgJCgnI21hdGNoLW1vZGFsJykubW9kYWwoJ2hpZGUnKTtcbiAgICAgICAgICAgICQoJyNtYXRjaFRhYmxlJykuaHRtbCgnJyk7XG4gICAgICAgICAgICBwcmV2aW91c0F0dHJNYXAgPSBtYXBwZWQ7XG4gICAgICAgICAgICBjYWxsYmFjayhtYXBwZWQpO1xuICAgICAgICB9XG4gICAgfSk7XG59XG5cblxuZnVuY3Rpb24gX3Jlc2V0VUkoKSB7XG4gICAgJCgnI21hdGNoVGFibGUnKS5odG1sKCcnKTtcbiAgICAkKCcjZmlsZS1sb2NhdGUnKS5odG1sKCcnKTtcbn1cblxuZnVuY3Rpb24gX2NyZWF0ZU1hdGNoU2VsZWN0b3Ioa2V5LCBhcnIsIG1hdGNoZXMpIHtcbiAgICB2YXIgc2VsZWN0ID0gJzxzZWxlY3QgY2xhc3M9XCJtYXRjaC1zZWxlY3RvclwiIGtleT1cIicra2V5KydcIj48b3B0aW9uPjwvb3B0aW9uPic7XG5cbiAgICBmb3IoIHZhciBpID0gMDsgaSA8IGFyci5sZW5ndGg7IGkrKyApIHtcbiAgICAgICAgaWYoIG1hdGNoZXMuaW5kZXhPZihhcnJbaV0pID4gLTEgKSBjb250aW51ZTtcbiAgICAgICAgc2VsZWN0ICs9ICc8b3B0aW9uIHZhbHVlPVwiJythcnJbaV0rJ1wiPicrYXJyW2ldKyc8L29wdGlvbj4nO1xuICAgIH1cbiAgICByZXR1cm4gc2VsZWN0ICsgJzwvc2VsZWN0Pic7XG59XG5cbmZ1bmN0aW9uIHNlbGVjdFdvcmtzaGVldChzaGVldE5hbWVzLCBjYWxsYmFjaykge1xuICAgIGNvbnNvbGUubG9nKHNoZWV0TmFtZXMpO1xuXG4gICAgaWYoIHNoZWV0TmFtZXMubGVuZ3RoID09IDEgKSBjYWxsYmFjayhzaGVldE5hbWVzWzBdKTtcblxuICAgIC8vIGFkZCBVSSBpbnRlcmFjdGlvbiBoZXJlXG4gICAgY2FsbGJhY2soc2hlZXROYW1lc1swXSk7XG59XG4iLCJtb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uKHByb2Nlc3MpIHtcbiAgJCgnI2Nsb3NlLXBvcHVwJykub24oJ2NsaWNrJywgZnVuY3Rpb24oKXtcbiAgICAkKCcjaW5mbycpLnJlbW92ZUNsYXNzKCdmYWRlSW5Eb3duJykuYWRkQ2xhc3MoJ3NsaWRlT3V0UmlnaHQnKTtcblxuICAgIC8vbGVnZW5kLnNlbGVjdChudWxsKTtcbiAgICBzZXRUaW1lb3V0KGZ1bmN0aW9uKCl7XG4gICAgICAkKCcjaW5mbycpLmhpZGUoKS5hZGRDbGFzcygnZmFkZUluRG93bicpLnJlbW92ZUNsYXNzKCdzbGlkZU91dFJpZ2h0Jyk7XG4gICAgfSwgODAwKTtcbiAgfSk7XG5cbiAgLy8gZmlsZSB1cGxvYWQgc3R1ZmZcbiAgJCgnI2ZpbGUtbW9kYWwnKS5tb2RhbCh7c2hvdzpmYWxzZX0pO1xuICAkKCcjZmlsZS1pbnB1dCcpLm9uKCdjaGFuZ2UnLCBmdW5jdGlvbihlKSB7XG4gICAgcHJvY2Vzcy5ydW4oZSk7XG4gIH0pO1xuICAkKCcjdXBsb2FkLWJ0bicpLm9uKCdjbGljaycsIGZ1bmN0aW9uKCl7XG4gICAgJCgnI2ZpbGUtbW9kYWwnKS5tb2RhbCgnc2hvdycpO1xuICB9KTtcblxuICAkKCdib2R5Jykub24oJ2RyYWdvdmVyJywgZnVuY3Rpb24oZSl7XG4gICAgZS5wcmV2ZW50RGVmYXVsdCgpO1xuICAgIGUuc3RvcFByb3BhZ2F0aW9uKCk7XG5cbiAgICAkKCcjdXBsb2FkLWRyb3AtbWVzc2FnZScpLnNob3coKTtcbiAgICAkKCcjd3JhcHBlcicpLmNzcygnb3BhY2l0eScsIDAuMyk7XG4gIH0pLm9uKCdkcmFnbGVhdmUnLCBmdW5jdGlvbihlKXtcbiAgICBlLnByZXZlbnREZWZhdWx0KCk7XG4gICAgZS5zdG9wUHJvcGFnYXRpb24oKTtcblxuICAgICQoJyN1cGxvYWQtZHJvcC1tZXNzYWdlJykuaGlkZSgpO1xuICAgICQoJyN3cmFwcGVyJykuY3NzKCdvcGFjaXR5JywxKTtcbiAgfSkub24oJ2Ryb3AnLCBmdW5jdGlvbihlKXtcbiAgICAkKCcjdXBsb2FkLWRyb3AtbWVzc2FnZScpLmhpZGUoKTtcbiAgICAkKCcjd3JhcHBlcicpLmNzcygnb3BhY2l0eScsMSk7XG5cbiAgICBwcm9jZXNzLnJ1bihlLm9yaWdpbmFsRXZlbnQpO1xuICAgICQoJyNmaWxlLW1vZGFsJykubW9kYWwoJ3Nob3cnKTtcblxuICB9KTtcbn07XG4iLCJ2YXIgbWFya2VyQ29uZmlnID0gcmVxdWlyZSgnLi4vbWFya2Vycy9jb25maWcnKTtcblxudmFyIG1hcDtcbnZhciBsYXllcnMgPSBbXTtcbnZhciBwb2ludHNCeUh1YyA9IHt9O1xudmFyIHVybFByZWZpeCA9ICdodHRwOi8vd2F0ZXJzaGVkLmljZS51Y2RhdmlzLmVkdS92aXpzb3VyY2UvcmVzdD92aWV3PWdldF9odWNfYnlfaWQoXFwnJztcbnZhciB1cmxQb3N0aXggPSAnXFwnKSZ0cT1TRUxFQ1QgKic7XG5cbnZhciBsb29rdXBVcmwgPSAnaHR0cDovL2F0bGFzLmN3cy51Y2RhdmlzLmVkdS9hcmNnaXMvcmVzdC9zZXJ2aWNlcy9XYXRlcnNoZWRzL01hcFNlcnZlci8wL3F1ZXJ5Pyc7XG52YXIgbG9va3VwUGFyYW1zID0ge1xuICAgIHdoZXJlIDogJycsXG4gICAgZ2VvbWV0cnlUeXBlIDogJ2VzcmlHZW9tZXRyeUVudmVsb3BlJyxcbiAgICBzcGF0aWFsUmVsIDogJ2VzcmlTcGF0aWFsUmVsSW50ZXJzZWN0cycsXG4gICAgb3V0RmllbGRzIDogJyonLFxuICAgIHJldHVybkdlb21ldHJ5IDogJ3RydWUnLFxuICAgIG91dFNSIDogJzQzMjYnLFxuICAgIGYgOiAncGpzb24nXG59O1xuXG52YXIgaHVjQ2FjaGUgPSB7fTtcbnZhciByZXF1ZXN0ZWQgPSB7fTtcblxudmFyIHNob3dpbmcgPSB0cnVlO1xudmFyIGN1cnJlbnRQb2ludHMgPSBudWxsO1xuXG5mdW5jdGlvbiBpbml0KG9wdGlvbnMpIHtcbiAgbWFwID0gb3B0aW9ucy5tYXAuZ2V0TGVhZmxldCgpO1xuXG4gICQoJyNyZW5kZXJIdWNBdmcnKS5vbignY2hhbmdlJywgZnVuY3Rpb24oKXtcbiAgICBzaG93aW5nID0gJCh0aGlzKS5pcygnOmNoZWNrZWQnKTtcbiAgICBvblZpc2liaWxpdHlVcGRhdGUoc2hvd2luZyk7XG4gIH0pO1xufVxuXG5mdW5jdGlvbiBvblZpc2liaWxpdHlVcGRhdGUoKSB7XG4gIGlmKCAhc2hvd2luZyApIHtcbiAgICBjbGVhcigpO1xuICB9IGVsc2UgaWYoIGN1cnJlbnRQb2ludHMgIT09IG51bGwgKXtcbiAgICByZW5kZXIoY3VycmVudFBvaW50cyk7XG4gIH1cbn1cblxuZnVuY3Rpb24gY2xlYXIoKSB7XG4gIC8vIGNsZWFyIGFsbCBsYXllcnNcbiAgZm9yKCB2YXIgaSA9IDA7IGkgPCBsYXllcnMubGVuZ3RoOyBpKysgKSB7XG4gICAgbWFwLnJlbW92ZUxheWVyKGxheWVyc1tpXSk7XG4gIH1cbiAgbGF5ZXJzID0gW107XG4gIHBvaW50c0J5SHVjID0ge307XG59XG5cbmZ1bmN0aW9uIHJlbmRlcihwb2ludHMpIHtcbiAgY3VycmVudFBvaW50cyA9IHBvaW50cztcbiAgaWYoICFzaG93aW5nICkgcmV0dXJuO1xuXG4gIGNsZWFyKCk7XG5cbiAgLy8gb3JnYW5pemUgcG9pbnRzIGJ5IGh1Y1xuICB2YXIgaHVjO1xuICBmb3IoIHZhciBpID0gMDsgaSA8IGN1cnJlbnRQb2ludHMubGVuZ3RoOyBpKysgKSB7XG4gICAgLy8gVE9ETzogZGlkIHF1aW5uIGNoYW5nZSB0aGlzP1xuICAgIGh1YyA9IHBvaW50c1tpXS5wcm9wZXJ0aWVzWydodWMtMTInXSB8fCBwb2ludHNbaV0ucHJvcGVydGllcy5odWNfMTI7XG5cbiAgICBpZiggcG9pbnRzQnlIdWNbaHVjXSApIHBvaW50c0J5SHVjW2h1Y10ucHVzaChwb2ludHNbaV0pO1xuICAgIGVsc2UgcG9pbnRzQnlIdWNbaHVjXSA9IFtwb2ludHNbaV1dO1xuICB9XG5cbiAgLy8gcmVxdWVzdCBtaXNzaW5nIGh1YyBnZW9qc29uIGFuZC9vciByZW5kZXIgaHVjXG4gIGZvciggdmFyIGh1YyBpbiBwb2ludHNCeUh1YyApIHtcbiAgICBpZiggaHVjID09PSB1bmRlZmluZWQgfHwgaHVjID09PSAndW5kZWZpbmVkJyApIHtcbiAgICAgIGRlYnVnZ2VyO1xuICAgICAgY29udGludWU7XG4gICAgfVxuXG4gICAgaWYoIGh1Y0NhY2hlW2h1Y10gKSByZW5kZXJIdWMoaHVjKTtcbiAgICBlbHNlIGlmKCAhcmVxdWVzdGVkW2h1Y10gKSByZXF1ZXN0KGh1Yyk7XG4gIH1cbn1cblxuZnVuY3Rpb24gcmVxdWVzdChodWNJZCkge1xuICByZXF1ZXN0ZWRbaHVjSWRdID0gMTtcblxuICB2YXIgcGFyYW1zID0gJC5leHRlbmQodHJ1ZSwge30sIGxvb2t1cFBhcmFtcyk7XG4gIHBhcmFtcy53aGVyZSA9ICdIVUNfMTIgPSBcXCcnK2h1Y0lkKydcXCcnO1xuICB2YXIgcGFyYW1UZXh0ID0gW107XG4gIGZvciggdmFyIGtleSBpbiBwYXJhbXMgKSB7XG4gICAgcGFyYW1UZXh0LnB1c2goa2V5Kyc9JytlbmNvZGVVUklDb21wb25lbnQocGFyYW1zW2tleV0pKTtcbiAgfVxuICAkLmdldChsb29rdXBVcmwrcGFyYW1UZXh0LmpvaW4oJyYnKSwgb25Mb29rdXBSZXNwb25zZSk7XG5cbiAgLyp2YXIgcXVlcnkgPSBuZXcgZ29vZ2xlLnZpc3VhbGl6YXRpb24uUXVlcnkodXJsUHJlZml4K2h1Y0lkK3VybFBvc3RpeCk7XG4gIHF1ZXJ5LnNldFRpbWVvdXQoNjAqNSk7IC8vIDUgbWluIHRpbWVvdXRcbiAgcXVlcnkuc2VuZChmdW5jdGlvbihyZXNwb25zZSl7XG4gICAgaWYgKHJlc3BvbnNlLmlzRXJyb3IoKSApIHJldHVybiBhbGVydCgnRXJyb3IgcmV0cmlldmluZyBIVUMgMTIgZGF0YSBmb3IgaWQgXCInK2h1Y0lkKydcIicpO1xuXG4gICAgdmFyIGRhdGEgPSByZXNwb25zZS5nZXREYXRhVGFibGUoKTtcblxuICAgIGlmKCBkYXRhLmdldE51bWJlck9mUm93cygpID09IDAgKSB7XG4gICAgICBkZWJ1Z2dlcjtcbiAgICAgIHJldHVybiBhbGVydCgnRXJyb3I6IGludmFsaWQgSFVDIDEyIGlkIFwiJytodWNJZCtcIidcIik7XG4gICAgfVxuXG4gICAgdmFyIGdlb21ldHJ5ID0gSlNPTi5wYXJzZShkYXRhLmdldFZhbHVlKDAsIDApKTtcbiAgICB2YXIgZ2VvanNvbkZlYXR1cmUgPSB7XG4gICAgICBcInR5cGVcIjogXCJGZWF0dXJlXCIsXG4gICAgICBcInByb3BlcnRpZXNcIjoge1xuICAgICAgICAgIFwiaWRcIjogaHVjSWQsXG4gICAgICB9LFxuICAgICAgXCJnZW9tZXRyeVwiOiBnZW9tZXRyeVxuICAgIH07XG4gICAgaHVjQ2FjaGVbaHVjSWRdID0gZ2VvanNvbkZlYXR1cmU7XG5cbiAgICByZW5kZXJIdWMoaHVjSWQpO1xuICB9KTsqL1xufVxuXG5mdW5jdGlvbiBvbkxvb2t1cFJlc3BvbnNlKHJlc3ApIHtcbiAgaWYoIHR5cGVvZiByZXNwID09PSAnc3RyaW5nJyApIHtcbiAgICByZXNwID0gSlNPTi5wYXJzZShyZXNwKTtcbiAgfVxuXG4gIGlmKCByZXNwLmZlYXR1cmVzICYmIHJlc3AuZmVhdHVyZXMubGVuZ3RoID4gMCApIHtcbiAgICB2YXIgZmVhdHVyZSA9IHJlc3AuZmVhdHVyZXNbMF07XG5cblxuICAgIHZhciBnZW9qc29uID0ge1xuICAgICAgJ3R5cGUnOiAnRmVhdHVyZScsXG4gICAgICAncHJvcGVydGllcyc6IGZlYXR1cmUuYXR0cmlidXRlcyxcbiAgICAgICdnZW9tZXRyeSc6IHtcbiAgICAgICAgdHlwZSA6ICdQb2x5Z29uJyxcbiAgICAgICAgY29vcmRpbmF0ZXMgOiBmZWF0dXJlLmdlb21ldHJ5LnJpbmdzXG4gICAgICB9XG4gICAgfTtcblxuICAgIGdlb2pzb24ucHJvcGVydGllcy5pZCA9IGdlb2pzb24ucHJvcGVydGllcy5IVUNfMTI7XG5cbiAgICBodWNDYWNoZVtnZW9qc29uLnByb3BlcnRpZXMuaWRdID0gZ2VvanNvbjtcblxuICAgIHJlbmRlckh1YyhnZW9qc29uLnByb3BlcnRpZXMuaWQpO1xuICB9XG59XG5cbmZ1bmN0aW9uIHJlbmRlckh1YyhpZCkge1xuICBpZiggIXNob3dpbmcgKSByZXR1cm47XG5cbiAgdmFyIHBvaW50cyA9IHBvaW50c0J5SHVjW2lkXTtcblxuICAvLyBjYWxjdWxhdGUgcGVyY2VudCBkZW1hbmRcbiAgdmFyIHBlcmNlbnREZW1hbmRzID0gW10sIGZlYXR1cmU7XG4gIGZvciggdmFyIGkgPSAwOyBpIDwgcG9pbnRzLmxlbmd0aDsgaSsrICkge1xuICAgIGZlYXR1cmUgPSBwb2ludHNbaV07XG5cbiAgICBpZiggZmVhdHVyZS5wcm9wZXJ0aWVzLmFsbG9jYXRpb25zICYmIGZlYXR1cmUucHJvcGVydGllcy5hbGxvY2F0aW9ucy5sZW5ndGggPiAwICkge1xuICAgICAgdmFyIGRlbWFuZCA9IGZlYXR1cmUucHJvcGVydGllcy5hbGxvY2F0aW9uc1swXS5kZW1hbmQ7XG4gICAgICB2YXIgYWxsb2NhdGlvbiA9IGZlYXR1cmUucHJvcGVydGllcy5hbGxvY2F0aW9uc1swXS5hbGxvY2F0aW9uO1xuXG4gICAgICBpZiggZGVtYW5kICE9IDAgKSB7XG4gICAgICAgIHBlcmNlbnREZW1hbmRzLnB1c2goYWxsb2NhdGlvbiAvIGRlbWFuZCk7XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgLy8gY2FsYyBhdmVyYWdlXG4gIHZhciBhdmdQcmVjZW50RGVtYW5kID0gLTE7XG4gIHZhciB0bXAgPSAwO1xuICBmb3IoIHZhciBpID0gMDsgaSA8IHBlcmNlbnREZW1hbmRzLmxlbmd0aDsgaSsrICkge1xuICAgIHRtcCArPSBwZXJjZW50RGVtYW5kc1tpXTtcbiAgfVxuICBpZiggcGVyY2VudERlbWFuZHMubGVuZ3RoID4gMCApIGF2Z1ByZWNlbnREZW1hbmQgPSB0bXAgLyBwZXJjZW50RGVtYW5kcy5sZW5ndGg7XG5cbiAgdmFyIGxheWVyID0gTC5nZW9Kc29uKFxuICAgIGh1Y0NhY2hlW2lkXSxcbiAgICB7XG4gICAgICBzdHlsZTogZnVuY3Rpb24oZmVhdHVyZSkge1xuICAgICAgICByZXR1cm4gbWFya2VyQ29uZmlnLnBlcmNlbnREZW1hbmRIdWMoYXZnUHJlY2VudERlbWFuZCk7XG4gICAgICB9XG4gICAgfVxuICApLmFkZFRvKG1hcCk7XG5cbiAgbGF5ZXJzLnB1c2gobGF5ZXIpO1xufVxuXG5mdW5jdGlvbiBnZXRDYWNoZSgpIHtcbiAgcmV0dXJuIGh1Y0NhY2hlO1xufVxuXG5tb2R1bGUuZXhwb3J0cyA9IHtcbiAgaW5pdCA6IGluaXQsXG4gIHJlbmRlciA6IHJlbmRlcixcbiAgY2xlYXIgOiBjbGVhcixcbiAgZ2V0Q2FjaGUgOiBnZXRDYWNoZVxufTtcbiIsInJlcXVpcmUoJy4vbGVhZmxldCcpOyAvLyBpbXBvcnQgY3VzdG9tIG1hcmtlcnMgdG8gbGVhZmxldCBuYW1lc3BhY2UgKGdsb2JhbClcbnZhciBtYXAgPSByZXF1aXJlKCcuL21hcCcpO1xudmFyIGh1YyA9IHJlcXVpcmUoJy4vaHVjJyk7XG52YXIgZmlsZSA9IHJlcXVpcmUoJy4vZmlsZScpO1xudmFyIGRpcmVjdG9yeSA9IHJlcXVpcmUoJy4vbGlicmFyeScpO1xudmFyIGRhdGFzdG9yZSA9IHJlcXVpcmUoJy4vZGF0YXN0b3JlJyk7XG5cblxudmFyIG1hcCwgZ2VvSnNvbkxheWVyO1xudmFyIHdtc0xheWVycyA9IFtdO1xudmFyIGFsbERhdGEgPSBbXTtcblxuLy8gc2hvdWxkIGJlIGZpbGxlZCBvciBlbXB0eTtcbnZhciByZW5kZXJEZW1hbmQgPSAnZW1wdHknO1xudmFyIGN1cnJlbnRQb2ludHMgPSBudWxsO1xudmFyIGxhc3RSZXNwUG9pbnRzID0gbnVsbDtcblxuJChkb2N1bWVudCkub24oJ3JlYWR5JywgZnVuY3Rpb24oKXtcbiAgcmVzaXplKCk7XG4gIGluaXQoKTtcbn0pO1xuXG4kKHdpbmRvdylcbiAgLm9uKCdyZXNpemUnLCByZXNpemUpO1xuXG5mdW5jdGlvbiBpbml0KCkge1xuICB2YXIgY29uZmlnID0ge1xuICAgIGRhdGFzdG9yZSA6IGRhdGFzdG9yZSxcbiAgICBtYXAgOiBtYXAsXG4gICAgaHVjIDogaHVjXG4gIH07XG5cbiAgbWFwLmluaXQoY29uZmlnKTtcbiAgaHVjLmluaXQoY29uZmlnKTtcbiAgZmlsZS5pbml0KGNvbmZpZyk7XG4gIGRpcmVjdG9yeS5pbml0KGNvbmZpZyk7XG5cbiAgLy8gcXVpY2tseSBsb2FkcyAvdGVzdGRhdGEvU2FjUml2ZXIuY3N2IGZvciB0ZXN0aW5nXG4gIC8vIHJlcXVpcmUoJy4vdGVzdCcpKGZpbGUpO1xufVxuXG5mdW5jdGlvbiByZXNpemUoKSB7XG4gIHZhciBoID0gd2luZG93LmlubmVySGVpZ2h0O1xuICB2YXIgdyA9IHdpbmRvdy5pbm5lcldpZHRoO1xuICBpZiggaCA9PT0gbnVsbCApIGggPSAkKHdpbmRvdykuaGVpZ2h0KCk7XG4gIGlmKCB3ID09PSBudWxsICkgdyA9ICQod2luZG93KS53aWR0aCgpO1xuXG4gICQoJyNtYXAnKS5oZWlnaHQoaCkud2lkdGgodyk7XG4gICQoJyNpbmZvJykuY3NzKCdtYXgtaGVpZ2h0JywgKGgtODUpKydweCcpO1xufVxuXG5tb2R1bGUuZXhwb3J0cyA9IHtcbiAgbWFwIDogbWFwLFxuICBodWMgOiBodWMsXG4gIGZpbGUgOiBmaWxlLFxuICBkaXJlY3RvcnkgOiBkaXJlY3RvcnksXG4gIGRzIDogZGF0YXN0b3JlXG59O1xuIiwidmFyIEljb25SZW5kZXJlciA9IHJlcXVpcmUoJy4uL21hcmtlcnMvaWNvblJlbmRlcmVyJyk7XG5cbkwuSWNvbi5DYW52YXMgPSBMLkljb24uZXh0ZW5kKHtcbiAgICBvcHRpb25zOiB7XG4gICAgICAgIGljb25TaXplOiBuZXcgTC5Qb2ludCgyMCwgMjApLCAvLyBIYXZlIHRvIGJlIHN1cHBsaWVkXG4gICAgICAgIGNsYXNzTmFtZTogJ2xlYWZsZXQtY2FudmFzLWljb24nXG4gICAgfSxcblxuICAgIGNyZWF0ZUljb246IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgdmFyIGUgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdjYW52YXMnKTtcbiAgICAgICAgdGhpcy5fc2V0SWNvblN0eWxlcyhlLCAnaWNvbicpO1xuXG4gICAgICAgIGUud2lkdGggPSB0aGlzLm9wdGlvbnMud2lkdGg7XG4gICAgICAgIGUuaGVpZ2h0ID0gdGhpcy5vcHRpb25zLmhlaWdodDtcblxuICAgICAgICBlLnN0eWxlLm1hcmdpblRvcCA9ICgtMSp0aGlzLm9wdGlvbnMud2lkdGgvMikrJ3B4JztcbiAgICAgICAgZS5zdHlsZS5tYXJnaW5MZWZ0ID0gKC0xKnRoaXMub3B0aW9ucy5oZWlnaHQvMikrJ3B4JztcblxuICAgICAgICBlLnN0eWxlLndpZHRoID0gdGhpcy5vcHRpb25zLndpZHRoKydweCc7XG4gICAgICAgIGUuc3R5bGUuaGVpZ2h0ID10aGlzLm9wdGlvbnMuaGVpZ2h0KydweCc7XG5cbiAgICAgICAgdGhpcy5kcmF3KGUuZ2V0Q29udGV4dCgnMmQnKSk7XG5cbiAgICAgICAgcmV0dXJuIGU7XG4gICAgfSxcblxuICAgIGNyZWF0ZVNoYWRvdzogZnVuY3Rpb24gKCkge1xuICAgICAgICByZXR1cm4gbnVsbDtcbiAgICB9LFxuXG5cbiAgICBkcmF3OiBmdW5jdGlvbihjdHgpIHtcbiAgICAgIEljb25SZW5kZXJlcihjdHgsIHRoaXMub3B0aW9ucyk7XG4gICAgfVxufSk7XG4iLCJ2YXIgSWNvblJlbmRlcmVyID0gcmVxdWlyZSgnLi4vbWFya2Vycy9pY29uUmVuZGVyZXInKTtcblxuTC5kd3JhdE1hcmtlciA9IGZ1bmN0aW9uIChsYXRsbmcsIG9wdGlvbnMpIHtcbiAgdmFyIG1hcmtlciA9IG5ldyBMLk1hcmtlcihsYXRsbmcsIHtcbiAgICAgIGljb246IG5ldyBMLkljb24uQ2FudmFzKG9wdGlvbnMpLFxuICAgICAgaWNvblNpemU6IG5ldyBMLlBvaW50KG9wdGlvbnMud2lkdGgsIG9wdGlvbnMuaGVpZ2h0KSxcbiAgfSk7XG5cbiAgbWFya2VyLnNldFN0eWxlID0gZnVuY3Rpb24ob3B0aW9ucykge1xuICAgIHZhciBvID0gdGhpcy5vcHRpb25zLmljb24ub3B0aW9ucztcblxuICAgICQuZXh0ZW5kKHRydWUsIG8sIG9wdGlvbnMpO1xuICAgIGlmKCAhdGhpcy5faWNvbiApIHJldHVybjtcblxuICAgIHZhciBjdHggPSB0aGlzLl9pY29uLmdldENvbnRleHQoJzJkJyk7XG4gICAgY3R4LmNsZWFyUmVjdCgwLCAwLCBvLndpZHRoLCBvLmhlaWdodCk7XG5cbiAgICBJY29uUmVuZGVyZXIoY3R4LCBvKTtcbiAgfTtcblxuICByZXR1cm4gbWFya2VyO1xufTtcbiIsInJlcXVpcmUoJy4vY2FudmFzJyk7XG5yZXF1aXJlKCcuL2R3cmF0Jyk7XG4iLCJ2YXIgRHJvdWdodEljb24gPSByZXF1aXJlKCcuLi9tYXJrZXJzL2Ryb3VnaHRJY29uJyk7XG52YXIgbWFya2VyQ29uZmlnID0gcmVxdWlyZSgnLi4vbWFya2Vycy9jb25maWcnKTtcbnZhciBtYXJrZXJUZW1wbGF0ZSA9IHJlcXVpcmUoJy4vdGVtcGxhdGUnKTtcbnZhciBtYXJrZXJzID0gbWFya2VyQ29uZmlnLmRlZmF1bHRzO1xudmFyIG1hcCwgZGF0YXN0b3JlO1xuXG5nbG9iYWwuc2V0dGluZ3MgPSB7XG4gIHJlbmRlckRlbWFuZCA6ICdlbXB0eSdcbn07XG5cbm1vZHVsZS5leHBvcnRzLmluaXQgPSBmdW5jdGlvbihjb25maWcpIHtcbiAgbWFwID0gY29uZmlnLm1hcDtcbiAgZGF0YXN0b3JlID0gY29uZmlnLmRhdGFzdG9yZTtcblxuICB2YXIgZGVtYW5kU3RlcHMgPSBbMCwgMSwgNTAsIDEwMCwgMjUwXTtcblxuICB2YXIgb3B0aW9ucyA9ICQuZXh0ZW5kKHRydWUsIHt9LCBtYXJrZXJzLnJpcGFyaWFuLnVuYWxsb2NhdGVkKTtcbiAgb3B0aW9ucy5zaWRlcyA9IDA7XG4gIHZhciBpY29uID0gbmV3IERyb3VnaHRJY29uKG9wdGlvbnMpO1xuICAkKCcjbGVnZW5kLXJpcGFyaWFuJykuYXBwZW5kKCQoaWNvbi5lbGUpKTtcblxuXG4gIG9wdGlvbnMgPSAkLmV4dGVuZCh0cnVlLCB7fSwgbWFya2Vycy5hcHBsaWNhdGlvbi51bmFsbG9jYXRlZCk7XG4gIG9wdGlvbnMuc2lkZXMgPSAzO1xuICBvcHRpb25zLnJvdGF0ZSA9IDkwO1xuICBpY29uID0gbmV3IERyb3VnaHRJY29uKG9wdGlvbnMpO1xuICAkKCcjbGVnZW5kLXByZS1hcHByb3ByaWF0aXZlJykuYXBwZW5kKCQoaWNvbi5lbGUpKTtcblxuICBpY29uID0gbmV3IERyb3VnaHRJY29uKG1hcmtlcnMuYXBwbGljYXRpb24udW5hbGxvY2F0ZWQpO1xuICAkKCcjbGVnZW5kLXBvc3QtYXBwcm9wcmlhdGl2ZScpLmFwcGVuZCgkKGljb24uZWxlKSk7XG5cbiAgdmFyIHRhYmxlID0gJzx0YWJsZSBzdHlsZT1cInRleHQtYWxpZ246Y2VudGVyXCI+PHRyIHN0eWxlPVwidmVydGljYWwtYWxpZ246IGJvdHRvbVwiPic7XG4gIHZhciBpY29ucyA9IFtdO1xuICBmb3IoIHZhciBpID0gMDsgaSA8IGRlbWFuZFN0ZXBzLmxlbmd0aDsgaSsrICkge1xuICAgIHRhYmxlICs9ICc8dGQgc3R5bGU9XCJwYWRkaW5nOjRweFwiPjxkaXYgaWQ9XCJsZWdlbmQtZGVtYW5kLScraSsnXCI+PC9kaXY+PGRpdj4nK1xuICAgICAgICAgICAgICAoZGVtYW5kU3RlcHNbaV0gPT0gMSA/ICc8JyA6ICcnKSArXG4gICAgICAgICAgICAgIChkZW1hbmRTdGVwc1tpXSA9PSAyNTAgPyAnPicgOiAnJykgK1xuICAgICAgICAgICAgICBkZW1hbmRTdGVwc1tpXSsnPC9kaXY+PC90ZD4nO1xuXG5cbiAgICBpZiggZGVtYW5kU3RlcHNbaV0gPT09IDAgKSB7XG4gICAgICBvcHRpb25zID0gJC5leHRlbmQodHJ1ZSwge30sIG1hcmtlcnMuYXBwbGljYXRpb24udW5hbGxvY2F0ZWQpO1xuICAgICAgb3B0aW9ucyA9ICQuZXh0ZW5kKHRydWUsIG9wdGlvbnMsIG1hcmtlcnMubm9EZW1hbmQpO1xuICAgIH0gZWxzZSB7XG4gICAgICBvcHRpb25zID0gJC5leHRlbmQodHJ1ZSwge30sIG1hcmtlcnMuYXBwbGljYXRpb24udW5hbGxvY2F0ZWQpO1xuXG4gICAgICB2YXIgc2l6ZSA9IE1hdGguc3FydChkZW1hbmRTdGVwc1tpXSkgKiAzO1xuICAgICAgaWYoIHNpemUgPiA1MCApIHNpemUgPSA1MDtcbiAgICAgIGlmKCBzaXplIDwgNyApIHNpemUgPSA3O1xuXG4gICAgICBvcHRpb25zLmhlaWdodCA9IChzaXplKjIpKzI7XG4gICAgICBvcHRpb25zLndpZHRoID0gKHNpemUqMikrMjtcbiAgICB9XG5cbiAgICBpY29ucy5wdXNoKG5ldyBEcm91Z2h0SWNvbihvcHRpb25zKSk7XG4gIH1cbiAgJCgnI2xlZ2VuZC1kZW1hbmQnKS5odG1sKHRhYmxlKyc8L3RyPjwvdGFibGU+Jyk7XG5cbiAgZm9yKCBpID0gMDsgaSA8IGljb25zLmxlbmd0aDsgaSsrICkge1xuICAgICQoJyNsZWdlbmQtZGVtYW5kLScraSkuYXBwZW5kKCQoaWNvbnNbaV0uZWxlKSk7XG4gIH1cblxuICB0aGlzLnJlZHJhd1BEZW1hbmRMZWdlbmQoKTtcblxuICAvLyBpbml0IHRvZ2dsZSBidXR0b25cblxuICAkKCcjbGVnZW5kVG9nZ2xlJykub24oJ2NsaWNrJywgZnVuY3Rpb24oKXtcbiAgICBpZiggdGhpcy5oYXNBdHRyaWJ1dGUoJ3Nob3dpbmcnKSApIHtcbiAgICAgIHRoaXMucmVtb3ZlQXR0cmlidXRlKCdzaG93aW5nJyk7XG4gICAgICAkKCcjbGVnZW5kJykuaGlkZSgnc2xvdycpO1xuICAgICAgdGhpcy5pbm5lckhUTUwgPSAnPGkgY2xhc3M9XCJmYSBmYS1hcnJvdy1yaWdodFwiPjwvaT4nO1xuXG4gICAgfSBlbHNlIHtcbiAgICAgIHRoaXMuc2V0QXR0cmlidXRlKCdzaG93aW5nJywgJycpO1xuICAgICAgJCgnI2xlZ2VuZCcpLnNob3coJ3Nsb3cnKTtcbiAgICAgIHRoaXMuaW5uZXJIVE1MID0gJzxpIGNsYXNzPVwiZmEgZmEtYXJyb3ctZG93blwiPjwvaT4nO1xuICAgIH1cbiAgfSk7XG5cbiAgJCgnI3JlbmRlclR5cGVGaWxsZWQnKS5vbignY2xpY2snLCBvblJlbmRlclR5cGVDaGFuZ2UpO1xuICAkKCcjcmVuZGVyVHlwZUVtcHR5Jykub24oJ2NsaWNrJywgb25SZW5kZXJUeXBlQ2hhbmdlKTtcblxuICAkKCcjc2hvd05vRGVtYW5kJykub24oJ2NsaWNrJywgZnVuY3Rpb24oKXtcbiAgICBtYXAuZ2VvanNvbi5jbGVhckxheWVyKCk7XG4gICAgdmFyIG5vRGVtYW5kID0gISQodGhpcykuaXMoJzpjaGVja2VkJyk7XG4gICAgbWFwLmdlb2pzb24uYWRkKGRhdGFzdG9yZS5nZXQobm9EZW1hbmQpKTtcbiAgfSk7XG59O1xuXG5mdW5jdGlvbiByZWRyYXdQRGVtYW5kTGVnZW5kKCkge1xuICB2YXIgcGVyY2VudFN0ZXBzID0gWzAsIDI1LCA1MCwgNzUsIDEwMF0sIGk7XG5cbiAgdmFyIHRhYmxlID0gJzx0YWJsZSBzdHlsZT1cInRleHQtYWxpZ246Y2VudGVyXCI+PHRyIHN0eWxlPVwidmVydGljYWwtYWxpZ246IGJvdHRvbVwiPic7XG4gIHZhciBpY29ucyA9IFtdO1xuXHRmb3IoIGkgPSAwOyBpIDwgcGVyY2VudFN0ZXBzLmxlbmd0aDsgaSsrICkge1xuXHRcdHRhYmxlICs9ICc8dGQgc3R5bGU9XCJwYWRkaW5nOjhweFwiPjxkaXYgaWQ9XCJsZWdlbmQtcHJlY2VudC1vZi1kZW1hbmQtJytpKydcIj48L2Rpdj48ZGl2PicrXG5cdFx0XHRcdFx0cGVyY2VudFN0ZXBzW2ldKyclPC9kaXY+PC90ZD4nO1xuXG5cdFx0dmFyIG9wdGlvbnMgPSAkLmV4dGVuZCh0cnVlLCB7fSwgbWFya2Vycy5hcHBsaWNhdGlvbi51bmFsbG9jYXRlZCk7XG5cbiAgICBtYXJrZXJDb25maWcucGVyY2VudERlbWFuZChvcHRpb25zLCBwZXJjZW50U3RlcHNbaV0gLyAxMDApO1xuXG5cdFx0aWNvbnMucHVzaChuZXcgRHJvdWdodEljb24ob3B0aW9ucykpO1xuXHR9XG5cdCQoJyNsZWdlbmQtcHJlY2VudC1vZi1kZW1hbmQnKS5odG1sKHRhYmxlKyc8L3RyPjwvdGFibGU+Jyk7XG5cblx0Zm9yKCBpID0gMDsgaSA8IGljb25zLmxlbmd0aDsgaSsrICkge1xuXHRcdCQoJyNsZWdlbmQtcHJlY2VudC1vZi1kZW1hbmQtJytpKS5hcHBlbmQoJChpY29uc1tpXS5lbGUpKTtcblx0fVxufTtcbm1vZHVsZS5leHBvcnRzLnJlZHJhd1BEZW1hbmRMZWdlbmQgPSByZWRyYXdQRGVtYW5kTGVnZW5kO1xuXG5mdW5jdGlvbiBvblJlbmRlclR5cGVDaGFuZ2UoKSB7XG4gIHZhciBzZXR0aW5ncyA9IGdsb2JhbC5zZXR0aW5ncztcbiAgdmFyIGlzRmlsbGVkQ2hlY2tlZCA9ICQoJyNyZW5kZXJUeXBlRmlsbGVkJykuaXMoJzpjaGVja2VkJyk7XG4gIHZhciBuZXdWYWwgPSBpc0ZpbGxlZENoZWNrZWQgPyAnZmlsbGVkJyA6ICdlbXB0eSc7XG5cbiAgaWYoIHNldHRpbmdzLnJlbmRlckRlbWFuZCA9PSBuZXdWYWwgKSByZXR1cm47XG4gIHNldHRpbmdzLnJlbmRlckRlbWFuZCA9IG5ld1ZhbDtcblxuICAvLyByZW5kZXIgbGVnZW5kXG4gIHJlZHJhd1BEZW1hbmRMZWdlbmQoKTtcblxuICBpZiggIWN1cnJlbnRQb2ludHMgKSByZXR1cm47XG5cbiAgbWFwLmdlb2pzb24uY2xlYXJMYXllcigpO1xuICB2YXIgbm9EZW1hbmQgPSAhJCh0aGlzKS5pcygnOmNoZWNrZWQnKTtcbiAgbWFwLmdlb2pzb24uYWRkKGRhdGFzdG9yZS5nZXQobm9EZW1hbmQpKTtcbn1cblxubW9kdWxlLmV4cG9ydHMuc3RhbXAgPSBmdW5jdGlvbihkYXRhKSB7XG4gIHZhciB0ZW1wbGF0ZSA9IG1hcmtlclRlbXBsYXRlO1xuICBmb3IoIHZhciBrZXkgaW4gZGF0YSApIHRlbXBsYXRlID0gdGVtcGxhdGUucmVwbGFjZSgne3snK2tleSsnfX0nLCBkYXRhW2tleV0pO1xuICByZXR1cm4gdGVtcGxhdGU7XG59O1xuIiwibW9kdWxlLmV4cG9ydHMgPSBcbiAgJzxkaXYgY2xhc3M9XCJzcGFjZXJcIj48L2Rpdj4nK1xuICAnPGgzPldhdGVyIFJpZ2h0L0NsYWltICM6IHt7YXBwbGljYXRpb25fbnVtYmVyfX08L2gzPicrXG4gICc8ZGl2IHN0eWxlPVwibWFyZ2luOjE1cHhcIj4nK1xuICAgICc8Yj5Gb3I6PC9iPiB7e2RhdGV9fTxiciAvPicrXG4gICAgJzxiPkFsbG9jYXRpb246PC9iPiB7e2FsbG9jYXRpb259fSBbQWMtZnQvZGF5XTxiciAvPicrXG4gICAgJzxiPkRlbWFuZDo8L2I+IHt7ZGVtYW5kfX0gW0FjLWZ0L2RheV0nK1xuICAgICc8YnIgLz48Yj5QZXJjZW50IG9mIERlbWFuZDogPC9iPnt7cmF0aW99fSU8YnIgLz4nK1xuICAgICc8ZGl2IGNsYXNzPVwid2VsbCB3ZWxsLXNtXCIgc3R5bGU9XCJtYXJnaW4tdG9wOjVweFwiPicrXG4gICAgJ3t7d2F0ZXJfcmlnaHRfdHlwZX19PGJyIC8+JytcbiAgICAnPGI+UHJpb3JpdHkgRGF0ZTo8L2I+IHt7cHJpb3JpdHlfZGF0ZX19JytcbiAgICAnPC9kaXY+JytcbiAgJzwvZGl2Pic7XG4iLCJ2YXIgZmlsZXMgPSBbXTtcblxudmFyIHJvb3QgPSAnaHR0cHM6Ly9kb2NzLmdvb2dsZS5jb20vc3ByZWFkc2hlZXRzL2QvMUFDaTdQMHBPeS1KUmp0dzZIcmliUXBoaEVPWi0wLUNrUV9tcW55Q2ZKY0kvZ3Zpei90cSc7XG52YXIgcG9wdXAsIGJvZHksIGZpbGUsIG1hcDtcblxuZnVuY3Rpb24gaW5pdChjb25maWcpIHtcbiAgZmlsZSA9IGNvbmZpZy5maWxlO1xuICBtYXAgPSBjb25maWcubWFwO1xuXG4gIHZhciBxdWVyeSA9IG5ldyBnb29nbGUudmlzdWFsaXphdGlvbi5RdWVyeShyb290KTtcbiAgcXVlcnkuc2VuZChvbkluaXRMb2FkKTtcblxuICBwb3B1cCA9ICQoJyNkaXJlY3RvcnktbW9kYWwnKS5tb2RhbCh7c2hvdzogZmFsc2V9KTtcbiAgYm9keSA9ICQoJyNkaXJlY3RvcnktbW9kYWwtYm9keScpO1xuXG4gICQoJyNkaXJlY3RvcnktYnRuJykub24oJ2NsaWNrJywgZnVuY3Rpb24oKXtcbiAgICBwb3B1cC5tb2RhbCgnc2hvdycpO1xuICB9KTtcbn1cblxuZnVuY3Rpb24gb25Jbml0TG9hZChyZXNwKSB7XG4gIGlmIChyZXNwLmlzRXJyb3IoKSkge1xuICAgIGFsZXJ0KCdFcnJvciBpbiBsb2FkaW5nIHB1YmxpYyBkaXJlY3RvcnkgbGlzdGluZzogJyArIHJlc3BvbnNlLmdldE1lc3NhZ2UoKSArICcgJyArIHJlc3BvbnNlLmdldERldGFpbGVkTWVzc2FnZSgpKTtcbiAgICByZXR1cm47XG4gIH1cblxuICB2YXIgZGF0YSA9IHJlc3AuZ2V0RGF0YVRhYmxlKCk7XG4gIHZhciByb3dMZW4gPSBkYXRhLmdldE51bWJlck9mUm93cygpO1xuICB2YXIgY29sTGVuID0gZGF0YS5nZXROdW1iZXJPZkNvbHVtbnMoKTtcblxuICB2YXIgdGFibGUgPSAnPGg0PlNlbGVjdCBGaWxlIHRvIExvYWQ8L2g0Pjx0YWJsZSBjbGFzcz1cInRhYmxlXCI+JztcbiAgZm9yKCB2YXIgaSA9IDA7IGkgPCByb3dMZW47IGkrKyApIHtcbiAgICB2YXIgZmlsZSA9IHt9O1xuICAgIGZvciggdmFyIGogPSAwOyBqIDwgY29sTGVuOyBqKysgKSB7XG4gICAgICBmaWxlW2RhdGEuZ2V0Q29sdW1uTGFiZWwoaildID0gZGF0YS5nZXRWYWx1ZShpLCBqKTtcbiAgICB9XG5cbiAgICB0YWJsZSArPSBmaWxlVG9Sb3coZmlsZSwgaSk7XG5cbiAgICBmaWxlcy5wdXNoKGZpbGUpO1xuICB9XG5cbiAgYm9keVxuICAgIC5odG1sKHRhYmxlKyc8L3RhYmxlPicpXG4gICAgLmZpbmQoJ2EnKVxuICAgIC5vbignY2xpY2snLCBmdW5jdGlvbigpe1xuICAgICAgdmFyIGZpbGUgPSBmaWxlc1twYXJzZUludCgkKHRoaXMpLmF0dHIoJ2luZGV4JykpXTtcbiAgICAgIGxvYWQoZmlsZS5SZWdpb24sIGZpbGUuSUQpO1xuICAgICAgcG9wdXAubW9kYWwoJ2hpZGUnKTtcbiAgICB9KTtcbn1cblxuZnVuY3Rpb24gbG9hZChuYW1lLCBpZCkge1xuICB2YXIgcXVlcnkgPSBuZXcgZ29vZ2xlLnZpc3VhbGl6YXRpb24uUXVlcnkoJ2h0dHBzOi8vZG9jcy5nb29nbGUuY29tL3NwcmVhZHNoZWV0cy9kLycraWQrJy9ndml6L3RxJyk7XG4gIHF1ZXJ5LnNlbmQoZnVuY3Rpb24ocmVzcCl7XG4gICAgaWYgKHJlc3AuaXNFcnJvcigpKSB7XG4gICAgICBhbGVydCgnRXJyb3IgaW4gbG9hZGluZyBwdWJsaWMgc2hlZXQ6ICcgKyByZXNwb25zZS5nZXRNZXNzYWdlKCkgKyAnICcgKyByZXNwb25zZS5nZXREZXRhaWxlZE1lc3NhZ2UoKSk7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgdmFyIGRhdGEgPSByZXNwLmdldERhdGFUYWJsZSgpO1xuICAgIHZhciByb3dMZW4gPSBkYXRhLmdldE51bWJlck9mUm93cygpO1xuICAgIHZhciBjb2xMZW4gPSBkYXRhLmdldE51bWJlck9mQ29sdW1ucygpO1xuICAgIHZhciBjc3YgPSBbW11dO1xuXG5cbiAgICBmb3IoIHZhciBpID0gMDsgaSA8IGNvbExlbjsgaSsrICkge1xuICAgICAgY3N2WzBdLnB1c2goZGF0YS5nZXRDb2x1bW5MYWJlbChpKSk7XG4gICAgfVxuXG4gICAgZm9yKCB2YXIgaSA9IDA7IGkgPCByb3dMZW47IGkrKyApIHtcbiAgICAgIHZhciByb3cgPSBbXTtcbiAgICAgIGZvciggdmFyIGogPSAwOyBqIDwgY29sTGVuOyBqKysgKSB7XG4gICAgICAgIHJvdy5wdXNoKGRhdGEuZ2V0VmFsdWUoaSwgaikpO1xuICAgICAgfVxuICAgICAgY3N2LnB1c2gocm93KTtcbiAgICB9XG5cbiAgICBmaWxlLnByb2Nlc3Muc2V0RmlsZW5hbWUobmFtZSk7XG4gICAgZmlsZS5wcm9jZXNzLm9uRmlsZVBhcnNlZChudWxsLCBjc3YpO1xuICB9KTtcbn1cblxuZnVuY3Rpb24gZmlsZVRvUm93KGZpbGUsIGluZGV4KSB7XG4gIHJldHVybiAnPHRyPicgK1xuICAgICc8dGQ+PGEgY2xhc3M9XCJidG4gYnRuLWxpbmtcIiBpbmRleD1cIicraW5kZXgrJ1wiPjxpIGNsYXNzPVwiZmEgZmEtZG93bmxvYWRcIj48L2k+ICcrZmlsZS5SZWdpb24rJzwvYT48L3RkPicrXG4gICAgJzx0ZD4nK2ZpbGVbJ1N0YXJ0IERhdGUnXS50b0RhdGVTdHJpbmcoKSsnPC90ZD4nK1xuICAgICc8dGQ+JytmaWxlWydFbmQgRGF0ZSddLnRvRGF0ZVN0cmluZygpKyc8L3RkPicrXG4gICc8L3RyPic7XG59XG5cbm1vZHVsZS5leHBvcnRzID0ge1xuICBpbml0IDogaW5pdFxufTtcbiIsInZhciBtYXJrZXJDb25maWcgPSByZXF1aXJlKCcuLi9tYXJrZXJzL2NvbmZpZycpO1xudmFyIG1hcmtlclNlbGVjdG9yID0gcmVxdWlyZSgnLi4vbWFya2VycycpO1xudmFyIG1hcmtlcnMgPSBtYXJrZXJDb25maWcuZGVmYXVsdHM7XG5cbnZhciBnZW9Kc29uTGF5ZXI7XG52YXIgbWFwLCBodWMsIGRhdGFzdG9yZSwgbWFwTW9kdWxlO1xuXG5tb2R1bGUuZXhwb3J0cy5pbml0ID0gZnVuY3Rpb24oY29uZmlnKSB7XG4gIG1hcE1vZHVsZSA9IGNvbmZpZy5tYXA7XG4gIG1hcCA9IGNvbmZpZy5tYXAuZ2V0TGVhZmxldCgpO1xuICBkYXRhc3RvcmUgPSBjb25maWcuZGF0YXN0b3JlO1xuICBodWMgPSBjb25maWcuaHVjO1xufTtcblxubW9kdWxlLmV4cG9ydHMuYWRkID0gZnVuY3Rpb24ocG9pbnRzKSB7XG4gIHZhciBzaG93Tm9EZW1hbmQgPSAkKCcjc2hvd05vRGVtYW5kJykuaXMoJzpjaGVja2VkJyk7XG4gIGRhdGFzdG9yZS5jbGVhckZlYXR1cmVzKCk7XG5cbiAgaWYoICFzaG93Tm9EZW1hbmQgKSB7XG4gICAgdG1wID0gW107XG4gICAgZm9yKCB2YXIgaSA9IHBvaW50cy5sZW5ndGgtMTsgaSA+PSAwOyBpLS0gKSB7XG4gICAgICBpZiggcG9pbnRzW2ldLnByb3BlcnRpZXMuYWxsb2NhdGlvbnMgJiYgcG9pbnRzW2ldLnByb3BlcnRpZXMuYWxsb2NhdGlvbnMubGVuZ3RoID4gMCApIHtcblxuICAgICAgICB2YXIgZGVtYW5kID0gcG9pbnRzW2ldLnByb3BlcnRpZXMuYWxsb2NhdGlvbnNbMF0uZGVtYW5kO1xuICAgICAgICBpZiggZGVtYW5kICE9PSAwICkgdG1wLnB1c2gocG9pbnRzW2ldKTtcbiAgICAgIH1cbiAgICB9XG4gICAgcG9pbnRzID0gdG1wO1xuICB9XG5cbiAgZ2VvSnNvbkxheWVyID0gTC5nZW9Kc29uKHBvaW50cyx7XG4gICAgcG9pbnRUb0xheWVyOiBmdW5jdGlvbiAoZmVhdHVyZSwgbGF0bG5nKSB7XG4gICAgICB2YXIgdHlwZSA9IGZlYXR1cmUucHJvcGVydGllcy5yaXBhcmlhbiA/ICdyaXBhcmlhbicgOiAnYXBwbGljYXRpb24nO1xuICAgICAgdmFyIGFsbG9jYXRpb24gPSAndW5hbGxvY2F0ZWQnO1xuXG4gICAgICBmb3IoIHZhciBpID0gMDsgaSA8IGZlYXR1cmUucHJvcGVydGllcy5hbGxvY2F0aW9ucy5sZW5ndGg7IGkrKyApIHtcbiAgICAgICAgaWYoIGZlYXR1cmUucHJvcGVydGllcy5hbGxvY2F0aW9uc1tpXS5hbGxvY2F0aW9uID4gMCApIGFsbG9jYXRpb24gPSAnYWxsb2NhdGVkJztcbiAgICAgIH1cblxuXG4gICAgICB2YXIgb3B0aW9ucyA9ICQuZXh0ZW5kKHRydWUsIHt9LCBtYXJrZXJzW3R5cGVdW2FsbG9jYXRpb25dKTtcblxuICAgICAgaWYoIGZlYXR1cmUucHJvcGVydGllcy5hbGxvY2F0aW9ucyAmJiBmZWF0dXJlLnByb3BlcnRpZXMuYWxsb2NhdGlvbnMubGVuZ3RoID4gMCApIHtcblxuICAgICAgICB2YXIgZGVtYW5kID0gZmVhdHVyZS5wcm9wZXJ0aWVzLmFsbG9jYXRpb25zWzBdLmRlbWFuZDtcbiAgICAgICAgdmFyIGFsbG9jYXRpb24gPSBmZWF0dXJlLnByb3BlcnRpZXMuYWxsb2NhdGlvbnNbMF0uYWxsb2NhdGlvbjtcblxuICAgICAgICBpZiggZGVtYW5kID09PSAwICkge1xuXG4gICAgICAgICAgJC5leHRlbmQodHJ1ZSwgb3B0aW9ucywgbWFya2Vycy5ub0RlbWFuZCk7XG4gICAgICAgICAgZmVhdHVyZS5wcm9wZXJ0aWVzLm5vRGVtYW5kID0gdHJ1ZTtcblxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIG1hcmtlckNvbmZpZy5wZXJjZW50RGVtYW5kKG9wdGlvbnMsIGFsbG9jYXRpb24gLyBkZW1hbmQpO1xuXG4gICAgICAgICAgdmFyIHNpemUgPSBNYXRoLnNxcnQoZGVtYW5kKSAqIDM7XG4gICAgICAgICAgaWYoIHNpemUgPiA1MCApIHNpemUgPSA1MDtcbiAgICAgICAgICBpZiggc2l6ZSA8IDcgKSBzaXplID0gNztcblxuICAgICAgICAgIG9wdGlvbnMuaGVpZ2h0ID0gc2l6ZSoyO1xuICAgICAgICAgIG9wdGlvbnMud2lkdGggPSBzaXplKjI7XG4gICAgICAgIH1cbiAgICAgIH1cblxuXG5cbiAgICAgIHZhciBtYXJrZXI7XG4gICAgICB2YXIgZDtcbiAgICAgIHRyeSB7XG4gICAgICAgIGQgPSBmZWF0dXJlLnByb3BlcnRpZXMucHJpb3JpdHlfZGF0ZSA/IHBhcnNlSW50KGZlYXR1cmUucHJvcGVydGllcy5wcmlvcml0eV9kYXRlLnJlcGxhY2UoLy0uKi8sJycpKSA6IDIwMDA7XG4gICAgICB9IGNhdGNoKGUpIHtcbiAgICAgICAgZCA9IDIwMDA7XG4gICAgICB9XG5cbiAgICAgIGlmKCBmZWF0dXJlLnByb3BlcnRpZXMucmlwYXJpYW4gKSB7XG4gICAgICAgIG9wdGlvbnMuc2lkZXMgPSAwO1xuICAgICAgICBtYXJrZXIgPSBMLmR3cmF0TWFya2VyKGxhdGxuZywgb3B0aW9ucyk7XG4gICAgICB9IGVsc2UgaWYgKCBkIDwgMTkxNCApIHtcbiAgICAgICAgb3B0aW9ucy5zaWRlcyA9IDM7XG4gICAgICAgIG9wdGlvbnMucm90YXRlID0gOTA7XG4gICAgICAgIG1hcmtlciA9IEwuZHdyYXRNYXJrZXIobGF0bG5nLCBvcHRpb25zKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIG1hcmtlciA9IEwuZHdyYXRNYXJrZXIobGF0bG5nLCBvcHRpb25zKTtcbiAgICAgIH1cblxuICAgICAgZGF0YXN0b3JlLmFkZEZlYXR1cmUoe1xuICAgICAgICBmZWF0dXJlIDogZmVhdHVyZSxcbiAgICAgICAgbWFya2VyICA6IG1hcmtlclxuICAgICAgfSk7XG4gICAgICByZXR1cm4gbWFya2VyO1xuICAgIH1cbiAgfSkuYWRkVG8obWFwKTtcblxuICBnZW9Kc29uTGF5ZXIub24oJ2NsaWNrJywgZnVuY3Rpb24oZSkge1xuICAgICQoJy5zZWxlY3QtdGV4dCcpLnJlbW92ZSgpO1xuICAgICQoJyNpbmZvJykuc2hvdygpO1xuICAgIHZhciBwcm9wcyA9IGUubGF5ZXIuZmVhdHVyZS5wcm9wZXJ0aWVzO1xuXG4gICAgbWFya2VyU2VsZWN0b3Iuc2VsZWN0KGUubGF5ZXIpO1xuXG4gICAgdmFyIGxsID0gZS5sYXllci5mZWF0dXJlLmdlb21ldHJ5LmNvb3JkaW5hdGVzO1xuXG4gICAgdmFyIHQsIGh0bWwgPSAnJztcbiAgICB2YXIgYWxsRGF0YSA9IGRhdGFzdG9yZS5nZXRGZWF0dXJlcygpO1xuICAgIGZvciggdmFyIGkgPSAwOyBpIDwgYWxsRGF0YS5sZW5ndGg7IGkrKyApIHtcbiAgICAgIHQgPSBhbGxEYXRhW2ldLmZlYXR1cmUuZ2VvbWV0cnkuY29vcmRpbmF0ZXM7XG4gICAgICBpZiggbGxbMF0udG9GaXhlZCg0KSA9PSB0WzBdLnRvRml4ZWQoNCkgJiYgbGxbMV0udG9GaXhlZCg0KSA9PSB0WzFdLnRvRml4ZWQoNCkgKSB7XG4gICAgICAgIHZhciBwID0gYWxsRGF0YVtpXS5mZWF0dXJlLnByb3BlcnRpZXM7XG5cbiAgICAgICAgaHRtbCArPSBtYXBNb2R1bGUubGVnZW5kLnN0YW1wKHtcbiAgICAgICAgICBhcHBsaWNhdGlvbl9udW1iZXIgOiBwLmFwcGxpY2F0aW9uX251bWJlcixcbiAgICAgICAgICBkYXRlIDogZ2V0RGF0ZShwLmFsbG9jYXRpb25zWzBdLmRhdGUpLFxuICAgICAgICAgIGFsbG9jYXRpb24gOiBwLmFsbG9jYXRpb25zWzBdLmFsbG9jYXRpb24sXG4gICAgICAgICAgZGVtYW5kIDogcC5hbGxvY2F0aW9uc1swXS5kZW1hbmQsXG4gICAgICAgICAgcmF0aW8gOiBwLmFsbG9jYXRpb25zWzBdLnJhdGlvICE9PSBudWxsID8gKHAuYWxsb2NhdGlvbnNbMF0ucmF0aW8qMTAwKS50b0ZpeGVkKDIpIDogJzEwMCcsXG4gICAgICAgICAgd2F0ZXJfcmlnaHRfdHlwZSA6IHBbJ1JpZ2h0IFR5cGUnXSB8fCBwLnJpcGFyaWFuLFxuICAgICAgICAgIHByaW9yaXR5X2RhdGUgOiBnZXREYXRlKHAucHJpb3JpdHlfZGF0ZSlcbiAgICAgICAgfSk7XG4gICAgICB9XG4gICAgfVxuXG5cbiAgICAkKCcjaW5mby1yZXN1bHQnKS5odG1sKGh0bWwpO1xuICAgICQoJyNpbmZvJykuYW5pbWF0ZSh7XG4gICAgICBzY3JvbGxUb3A6ICQoJy5pbmZvLWJveCcpLmhlaWdodCgpXG4gICAgfSwgMzAwKTtcbiAgfSk7XG5cbiAgY3VycmVudFBvaW50cyA9IHBvaW50cztcbiAgaHVjLnJlbmRlcihwb2ludHMpO1xufTtcblxuZnVuY3Rpb24gZ2V0RGF0ZShkKSB7XG4gIGlmKCBkID09PSB1bmRlZmluZWQgKSByZXR1cm4gJ1Vua25vd24nO1xuICBpZiggdHlwZW9mIGQgPT09ICdzdHJpbmcnICkgcmV0dXJuIGQ7XG4gIHJldHVybiBkLnRvRGF0ZVN0cmluZygpO1xufVxuXG5tb2R1bGUuZXhwb3J0cy5jbGVhckxheWVyID0gZnVuY3Rpb24oKSB7XG4gIGlmKCBnZW9Kc29uTGF5ZXIgKSBtYXAucmVtb3ZlTGF5ZXIoZ2VvSnNvbkxheWVyKTtcbn07XG4iLCJ2YXIgbWFwO1xudmFyIGJhc2VNYXBzID0ge307XG52YXIgb3ZlcmxheU1hcHMgPSB7fTtcblxudmFyIGdlb2pzb24gPSByZXF1aXJlKCcuL2dlb2pzb24nKTtcbnZhciBnZW9qc29uTGF5ZXIgPSB7fTtcblxudmFyIGN1cnJlbnRQb2ludHMgPSBudWxsO1xudmFyIGN1cnJlbnRHZW9qc29uID0gbnVsbDtcblxubW9kdWxlLmV4cG9ydHMubGVnZW5kID0gcmVxdWlyZSgnLi4vbGVnZW5kJyk7XG5tb2R1bGUuZXhwb3J0cy5nZW9qc29uID0gcmVxdWlyZSgnLi9nZW9qc29uJyk7XG5cblxuXG5tb2R1bGUuZXhwb3J0cy5pbml0ID0gZnVuY3Rpb24ob3B0aW9ucykge1xuICBtYXAgPSBMLm1hcCgnbWFwJyx7dHJhY2tSZXNpemU6dHJ1ZX0pO1xuXG4gIC8vIGFkZCBhbiBPcGVuU3RyZWV0TWFwIHRpbGUgbGF5ZXJcbiAgTC50aWxlTGF5ZXIoJ2h0dHA6Ly97c30udGlsZS5vc20ub3JnL3t6fS97eH0ve3l9LnBuZycsIHtcbiAgICAgIGF0dHJpYnV0aW9uOiAnJmNvcHk7IDxhIGhyZWY9XCJodHRwOi8vb3NtLm9yZy9jb3B5cmlnaHRcIj5PcGVuU3RyZWV0TWFwPC9hPiBjb250cmlidXRvcnMnXG4gIH0pLmFkZFRvKG1hcCk7XG5cbiAgdmFyIHdtczEgPSBMLnRpbGVMYXllci53bXMoXCJodHRwczovL21hcHNlbmdpbmUuZ29vZ2xlLmNvbS8xNTU0MjYwMDczNDI3NTU0OTQ0NC0xMTg1MzY2NzI3MzEzMTU1MDM0Ni00L3dtcy8/dmVyc2lvbj0xLjMuMFwiLCB7XG4gICAgICBsYXllcnM6ICcxNTU0MjYwMDczNDI3NTU0OTQ0NC0wODExMjk3NDY5MDk5MTE2NDU4Ny00JyxcbiAgICAgIGZvcm1hdDogJ2ltYWdlL3BuZycsXG4gICAgICB0cmFuc3BhcmVudDogdHJ1ZSxcbiAgICAgIGF0dHJpYnV0aW9uOiBcIlwiLFxuICAgICAgYm91bmRzIDogTC5sYXRMbmdCb3VuZHMoXG4gICAgICAgIEwubGF0TG5nKDQyLjAwOTQzMTk4ODA0MDU4LCAtMTE0LjEzMDc1OTcyMTM0MDcpLFxuICAgICAgICBMLmxhdExuZygzMi41MzQyNjM0NTM2NzQ5MywgLTEyNC40MDk3MTE3MTY3ODI5OClcbiAgICAgIClcbiAgfSkuYWRkVG8obWFwKTtcblxuICAvKnZhciB3bXMyID0gTC50aWxlTGF5ZXIud21zKFwiaHR0cHM6Ly9tYXBzZW5naW5lLmdvb2dsZS5jb20vMTU1NDI2MDA3MzQyNzU1NDk0NDQtMTE4NTM2NjcyNzMxMzE1NTAzNDYtNC93bXMvP3ZlcnNpb249MS4zLjBcIiwge1xuICAgICAgbGF5ZXJzOiAnMTU1NDI2MDA3MzQyNzU1NDk0NDQtMTYxNDMxNTg2ODk2MDMzNjEwOTMtNCcsXG4gICAgICBmb3JtYXQ6ICdpbWFnZS9wbmcnLFxuICAgICAgdHJhbnNwYXJlbnQ6IHRydWUsXG4gICAgICBhdHRyaWJ1dGlvbjogXCJcIixcbiAgICAgIGJvdW5kcyA6IEwubGF0TG5nQm91bmRzKFxuICAgICAgICBMLmxhdExuZyg0Mi4wMDk0MzE5ODgwNDA1OCwgLTExNC4xMzA3NTk3MjEzNDA3KSxcbiAgICAgICAgTC5sYXRMbmcoMzIuNTM0MjYzNDUzNjc0OTMsIC0xMjQuNDA5NzExNzE2NzgyOTgpXG4gICAgICApXG4gIH0pOyovXG4gIHZhciB3bXMyID0gTC50aWxlTGF5ZXIud21zKFwiaHR0cDovL2F0bGFzLmN3cy51Y2RhdmlzLmVkdS9hcmNnaXMvc2VydmljZXMvV2F0ZXJzaGVkcy9NYXBTZXJ2ZXIvV01TU2VydmVyXCIsIHtcbiAgICAgIGxheWVyczogJzAnLFxuICAgICAgZm9ybWF0OiAnaW1hZ2UvcG5nJyxcbiAgICAgIHRyYW5zcGFyZW50OiB0cnVlLFxuICAgICAgYXR0cmlidXRpb246IFwiXCIsXG4gICAgICBib3VuZHMgOiBMLmxhdExuZ0JvdW5kcyhcbiAgICAgICAgTC5sYXRMbmcoNDMuMzUzMTQ0LCAtMTEzLjA1ODQ0MyksXG4gICAgICAgIEwubGF0TG5nKDMyLjA0NDUyOCwgLTEyNC43MTg2MzgpXG4gICAgICApXG4gIH0pO1xuXG4gIGJhc2VNYXBzID0ge307XG4gIG92ZXJsYXlNYXBzID0ge1xuICAgICdXYXRlcnNoZWRzJzogd21zMSxcbiAgICAnSFVDIDEyJzogd21zMlxuICB9O1xuXG4gIEwuY29udHJvbC5sYXllcnMoYmFzZU1hcHMsIG92ZXJsYXlNYXBzLCB7cG9zaXRpb246ICdib3R0b21sZWZ0J30pLmFkZFRvKG1hcCk7XG5cbiAgb3B0aW9ucy5tYXAgPSB0aGlzO1xuICBnZW9qc29uLmluaXQob3B0aW9ucyk7XG4gIHRoaXMubGVnZW5kLmluaXQob3B0aW9ucyk7XG59O1xuXG5tb2R1bGUuZXhwb3J0cy5jbGVhckdlb2pzb25MYXllciA9IGZ1bmN0aW9uKCkge1xuICBnZW9qc29uLmNsZWFyTGF5ZXIoKTtcbn07XG5tb2R1bGUuZXhwb3J0cy5nZXRMZWFmbGV0ID0gZnVuY3Rpb24oKSB7XG4gIHJldHVybiBtYXA7XG59O1xuIiwidmFyIG1hcmtlcnMgPSB7XG4gIHJpcGFyaWFuIDoge1xuICAgIGFsbG9jYXRlZCA6IHtcbiAgICAgIGZpbGxDb2xvciAgIDogXCIjMjUyNUM5XCIsXG4gICAgICBjb2xvciAgICAgICA6IFwiIzMzMzMzM1wiLFxuICAgICAgd2VpZ2h0ICAgICAgOiAxLFxuICAgICAgb3BhY2l0eSAgICAgOiAxLFxuICAgICAgZmlsbE9wYWNpdHkgOiAwLjMsXG5cdFx0XHRzaWRlcyA6IDMsXG5cdFx0XHRyb3RhdGUgOiA5MCxcbiAgICAgIHdpZHRoOiAyMCxcbiAgICAgIGhlaWdodDogMjBcbiAgICB9LFxuICAgIHVuYWxsb2NhdGVkIDoge1xuICAgICAgZmlsbENvbG9yICAgOiBcIiNmZmZmZmZcIixcbiAgICAgIGNvbG9yICAgICAgIDogXCIjMzMzMzMzXCIsXG4gICAgICB3ZWlnaHQgICAgICA6IDEsXG4gICAgICBvcGFjaXR5ICAgICA6IDEsXG4gICAgICBmaWxsT3BhY2l0eSA6IDAuMyxcblx0XHRcdHNpZGVzIDogMyxcblx0XHRcdHJvdGF0ZSA6IDkwLFxuICAgICAgd2lkdGg6IDIwLFxuICAgICAgaGVpZ2h0OiAyMFxuICAgIH1cbiAgfSxcbiAgYXBwbGljYXRpb24gOiB7XG4gICAgYWxsb2NhdGVkIDoge1xuICAgICAgZmlsbENvbG9yICAgOiBcIiMyNTI1QzlcIixcbiAgICAgIGNvbG9yICAgICAgIDogXCIjMzMzMzMzXCIsXG4gICAgICB3ZWlnaHQgICAgICA6IDEsXG4gICAgICBvcGFjaXR5ICAgICA6IDEsXG4gICAgICBmaWxsT3BhY2l0eSA6IDAuMyxcbiAgICAgIHNpZGVzICAgICAgIDogNCxcbiAgICAgIHJvdGF0ZSAgICAgIDogNDUsXG4gICAgICB3aWR0aDogMjAsXG4gICAgICBoZWlnaHQ6IDIwXG4gICAgfSxcbiAgICB1bmFsbG9jYXRlZCA6IHtcbiAgICAgIGZpbGxDb2xvciAgIDogXCIjZmZmZmZmXCIsXG4gICAgICBjb2xvciAgICAgICA6IFwiIzMzMzMzM1wiLFxuICAgICAgd2VpZ2h0ICAgICAgOiAxLFxuICAgICAgb3BhY2l0eSAgICAgOiAxLFxuICAgICAgZmlsbE9wYWNpdHkgOiAwLjMsXG4gICAgICBzaWRlcyAgICAgICA6IDQsXG4gICAgICByb3RhdGUgICAgICA6IDQ1LFxuICAgICAgd2lkdGg6IDIwLFxuICAgICAgaGVpZ2h0OiAyMFxuICAgIH1cbiAgfSxcbiAgbm9EZW1hbmQgOiB7XG4gICAgbm9GaWxsIDogdHJ1ZSxcbiAgICAvL3NpZGVzIDogMCxcbiAgICBjb2xvciA6IFwiIzMzMzMzM1wiLFxuICAgIHN0cmlrZXRocm91Z2ggOiB0cnVlLFxuICAgIHJhZGl1cyA6IDUsXG4gICAgaGVpZ2h0IDogMTIsXG4gICAgd2lkdGggOiAxMlxuICB9XG59O1xubW9kdWxlLmV4cG9ydHMuZGVmYXVsdHMgPSBtYXJrZXJzO1xuXG5tb2R1bGUuZXhwb3J0cy5wZXJjZW50RGVtYW5kID0gZnVuY3Rpb24ob3B0aW9ucywgcGVyY2VudCwgbm9EZW1hbmQpIHtcbiAgaWYoIG5vRGVtYW5kICkge1xuICAgICAkLmV4dGVuZCh0cnVlLCBvcHRpb25zLCBtYXJrZXJzLm5vRGVtYW5kKTtcbiAgICAgcmV0dXJuO1xuICB9XG5cbiAgdmFyIG87XG5cbiAgaWYoIGdsb2JhbC5zZXR0aW5ncy5yZW5kZXJEZW1hbmQgPT0gJ2ZpbGxlZCcgKSB7XG5cbiAgICBpZiggcGVyY2VudCA8PSAwICkge1xuICAgICAgb3B0aW9ucy5maWxsQ29sb3IgPSAnIzMzMyc7XG4gICAgICBvcHRpb25zLmZpbGxPcGFjaXR5ID0gMC4zO1xuICAgIH0gZWxzZSB7XG4gICAgICBvID0gcGVyY2VudDtcbiAgICAgIGlmKCBvID4gMSApIG8gPSAxO1xuICAgICAgb3B0aW9ucy5maWxsT3BhY2l0eSA9IG87XG4gICAgICBvcHRpb25zLmZpbGxDb2xvciA9ICcjMDAwMGZmJztcbiAgICB9XG5cbiAgfSBlbHNlIHtcblxuICAgIGlmKCBwZXJjZW50ID49IDEgKSB7XG4gICAgICBvcHRpb25zLmZpbGxDb2xvciA9ICcjMzMzJztcbiAgICAgIG9wdGlvbnMuZmlsbE9wYWNpdHkgPSAwLjM7XG4gICAgfSBlbHNlIHtcbiAgICAgIG8gPSAxIC0gcGVyY2VudDtcbiAgICAgIGlmKCBvID4gMSApIG8gPSAxO1xuICAgICAgaWYoIG8gPCAwICkgbyA9IDA7XG5cbiAgICAgIG9wdGlvbnMuZmlsbE9wYWNpdHkgPSBvO1xuICAgICAgb3B0aW9ucy5maWxsQ29sb3IgPSAnI2ZmMDAwMCc7XG4gICAgfVxuXG4gIH1cbiAgLy9vcHRpb25zLmZpbGxDb2xvciA9ICcjJytnZXRDb2xvcihhbGxvY2F0aW9uIC8gZGVtYW5kKTtcbn07XG5cbm1vZHVsZS5leHBvcnRzLnBlcmNlbnREZW1hbmRIdWMgPSBmdW5jdGlvbihwZXJjZW50KSB7XG4gIGlmKCBwZXJjZW50ID09IC0xICkge1xuICAgICByZXR1cm4ge1xuICAgICAgIGZpbGxDb2xvciA6ICcjZmZmZmZmJyxcbiAgICAgICBmaWxsT3BhY2l0eSA6IDAuMixcbiAgICAgICB3ZWlnaHQgOiAxLFxuICAgICAgIGNvbG9yOiAnIzMzMzMzMydcbiAgICAgfTtcbiAgfVxuXG5cbiAgaWYoIGdsb2JhbC5zZXR0aW5ncy5yZW5kZXJEZW1hbmQgPT0gJ2ZpbGxlZCcgKSB7XG5cbiAgICBpZiggcGVyY2VudCA8PSAwICkge1xuXG4gICAgICByZXR1cm4ge1xuICAgICAgICBmaWxsQ29sb3IgOiAnIzMzMzMzMycsXG4gICAgICAgIGZpbGxPcGFjaXR5IDogMC4zLFxuICAgICAgICB3ZWlnaHQgOiAyLFxuICAgICAgICBjb2xvcjogJyMzMzMzMzMnXG4gICAgICB9O1xuXG5cbiAgICB9IGVsc2Uge1xuICAgICAgdmFyIG8gPSBwZXJjZW50O1xuICAgICAgaWYoIG8gPiAwLjggKSBvID0gMC44O1xuXG4gICAgICByZXR1cm4ge1xuICAgICAgICBmaWxsQ29sb3IgOiAnIzAwMDBmZicsXG4gICAgICAgIGZpbGxPcGFjaXR5IDogbyxcbiAgICAgICAgd2VpZ2h0IDogMixcbiAgICAgICAgY29sb3I6ICcjMzMzMzMzJ1xuICAgICAgfTtcbiAgICB9XG5cbiAgfSBlbHNlIHtcblxuICAgIGlmKCBwZXJjZW50ID49IDEgKSB7XG5cbiAgICAgIHJldHVybiB7XG4gICAgICAgIGZpbGxDb2xvciA6ICcjMzMzMzMzJyxcbiAgICAgICAgZmlsbE9wYWNpdHkgOiAwLjMsXG4gICAgICAgIHdlaWdodCA6IDIsXG4gICAgICAgIGNvbG9yOiAnIzMzMzMzMydcbiAgICAgIH07XG5cbiAgICB9IGVsc2Uge1xuICAgICAgdmFyIG8gPSAxIC0gcGVyY2VudDtcbiAgICAgIGlmKCBvID4gMC44ICkgbyA9IDAuODtcbiAgICAgIGlmKCBvIDwgMCApIG8gPSAwO1xuXG4gICAgICByZXR1cm4ge1xuICAgICAgICBmaWxsQ29sb3IgOiAnI2ZmMDAwMCcsXG4gICAgICAgIGZpbGxPcGFjaXR5IDogbyxcbiAgICAgICAgd2VpZ2h0IDogMixcbiAgICAgICAgY29sb3I6ICcjMzMzMzMzJ1xuICAgICAgfTtcblxuICAgIH1cblxuICB9XG4gIC8vb3B0aW9ucy5maWxsQ29sb3IgPSAnIycrZ2V0Q29sb3IoYWxsb2NhdGlvbiAvIGRlbWFuZCk7XG59O1xuIiwidmFyIEljb25SZW5kZXJlciA9IHJlcXVpcmUoJy4vaWNvblJlbmRlcmVyJyk7XG5cbm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24oY29uZmlnKSB7XG4gIHRoaXMuY29uZmlnID0gY29uZmlnO1xuICB0aGlzLmVsZSA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2NhbnZhcycpO1xuXG4gIHRoaXMucmVkcmF3ID0gZnVuY3Rpb24oKSB7XG4gICAgdmFyIHcgPSBjb25maWcuaGVpZ2h0IHx8IDMyO1xuICAgIHZhciBoID0gY29uZmlnLndpZHRoIHx8IDMyO1xuXG4gICAgdGhpcy5lbGUuaGVpZ2h0ID0gaDtcbiAgICB0aGlzLmVsZS53aWR0aCA9IHc7XG5cbiAgICB2YXIgY3R4ID0gdGhpcy5lbGUuZ2V0Q29udGV4dChcIjJkXCIpO1xuICAgIGN0eC5jbGVhclJlY3QoMCwgMCwgdywgaCk7XG5cbiAgICBJY29uUmVuZGVyZXIoY3R4LCBjb25maWcpO1xuICB9O1xuXG4gIHRoaXMucmVkcmF3KCk7XG59O1xuIiwidmFyIHV0aWwgPSByZXF1aXJlKCcuL3V0aWxzJyk7XG5cbm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24oY3R4LCBjb25maWcpIHtcblxuICB2YXIgc2lkZXMgPSBjb25maWcuc2lkZXMgIT09IG51bGwgPyBjb25maWcuc2lkZXMgOiA2O1xuICB2YXIgcm90YXRlID0gY29uZmlnLnJvdGF0ZSA/IGNvbmZpZy5yb3RhdGUgOiAwO1xuICB2YXIgeCA9IGNvbmZpZy53aWR0aCAvIDI7XG4gIHZhciB5ID0gY29uZmlnLmhlaWdodCAvIDI7XG5cbiAgdmFyIGEgPSAoKE1hdGguUEkgKiAyKSAvIGNvbmZpZy5zaWRlcyk7XG4gIHZhciByID0gcm90YXRlICogKE1hdGguUEkgLyAxODApO1xuXG4gIHZhciByYWRpdXMgPSAoY29uZmlnLndpZHRoIC8gMikgLSAxO1xuXG4gIHZhciBmaWxsU3R5bGUgPSB1dGlsLmhleFRvUmdiKGNvbmZpZy5maWxsQ29sb3IpO1xuICBmaWxsU3R5bGUucHVzaChjb25maWcuZmlsbE9wYWNpdHkpO1xuICBjdHguZmlsbFN0eWxlID0gJ3JnYmEoJytmaWxsU3R5bGUuam9pbignLCcpKycpJztcblxuICBjdHguc3Ryb2tlU3R5bGUgPSBjb25maWcuY29sb3I7XG5cbiAgLy8gdGhpbmsgeW91IG5lZWQgdG8gYWRqdXN0IGJ5IHgsIHlcbiAgY3R4LmJlZ2luUGF0aCgpO1xuXG4gIC8vIGRyYXcgY2lyY2xlXG4gIGlmICggc2lkZXMgPCAzICkge1xuXG4gICAgY3R4LmFyYyh4LCB5LCByYWRpdXMsIDAsIDIqTWF0aC5QSSk7XG5cbiAgfSBlbHNlIHtcblxuICAgIHZhciB0eCwgdHksIGk7XG4gICAgZm9yIChpID0gMDsgaSA8IGNvbmZpZy5zaWRlczsgaSsrKSB7XG4gICAgICB0eCA9IHggKyAocmFkaXVzICogTWF0aC5jb3MoYSppLXIpKTtcbiAgICAgIHR5ID0geSArIChyYWRpdXMgKiBNYXRoLnNpbihhKmktcikpO1xuXG4gICAgICBpZiggaSA9PT0gMCApIGN0eC5tb3ZlVG8odHgsIHR5KTtcbiAgICAgIGVsc2UgY3R4LmxpbmVUbyh0eCwgdHkpO1xuICAgIH1cbiAgICBjdHgubGluZVRvKHggKyAocmFkaXVzICogTWF0aC5jb3MoLTEgKiByKSksIHkgKyAocmFkaXVzICogTWF0aC5zaW4oLTEgKiByKSkpO1xuICB9XG5cbiAgaWYoICFjb25maWcubm9GaWxsICkgY3R4LmZpbGwoKTtcbiAgY3R4LnN0cm9rZSgpO1xuXG4gIGlmKCBjb25maWcuc3RyaWtldGhyb3VnaCApIHtcbiAgICBjdHguYmVnaW5QYXRoKCk7XG4gICAgY3R4Lm1vdmVUbygxLDEpO1xuICAgIGN0eC5saW5lVG8oKHgqMikgLSAxLCAoeSoyKSAtIDEpO1xuICAgIGN0eC5zdHJva2UoKTtcbiAgfVxufVxuIiwidmFyIHNlbGVjdGVkID0gbnVsbDtcblxubW9kdWxlLmV4cG9ydHMuc2VsZWN0ID0gZnVuY3Rpb24obWFya2VyKSB7XG4gIGlmKCBzZWxlY3RlZCAhPT0gbnVsbCApIHtcbiAgICBzZWxlY3RlZC5zZXRTdHlsZSh7XG4gICAgICBjb2xvciA6ICcjMzMzJyxcbiAgICAgIHdlaWdodCA6IDFcbiAgICB9KTtcbiAgICBpZiggc2VsZWN0ZWQucmVkcmF3ICkgc2VsZWN0ZWQucmVkcmF3KCk7XG4gIH1cblxuICBpZiggbWFya2VyICkge1xuICAgIG1hcmtlci5zZXRTdHlsZSh7XG4gICAgICBjb2xvciA6ICcjZmYwMDAwJyxcbiAgICAgIHdlaWdodCA6IDJcbiAgICB9KTtcbiAgICBpZiggbWFya2VyLnJlZHJhdyApIG1hcmtlci5yZWRyYXcoKTtcbiAgfVxuXG4gIHNlbGVjdGVkID0gbWFya2VyO1xufTtcbiIsIm1vZHVsZS5leHBvcnRzLmhleFRvUmdiID0gZnVuY3Rpb24oaGV4KSB7XG4gICAgdmFyIHJlc3VsdCA9IC9eIz8oW2EtZlxcZF17Mn0pKFthLWZcXGRdezJ9KShbYS1mXFxkXXsyfSkkL2kuZXhlYyhoZXgpO1xuICAgIHJldHVybiByZXN1bHQgPyBbXG4gICAgICAgIHBhcnNlSW50KHJlc3VsdFsxXSwgMTYpLFxuICAgICAgICBwYXJzZUludChyZXN1bHRbMl0sIDE2KSxcbiAgICAgICAgcGFyc2VJbnQocmVzdWx0WzNdLCAxNilcbiAgICBdIDogWzAsMCwwXTtcbn07XG5cbm1vZHVsZS5leHBvcnRzLmdldENvbG9yID0gZnVuY3Rpb24obnVtKSB7XG4gIGlmKCBudW0gPiAxICkgbnVtID0gMTtcbiAgaWYoIG51bSA8IDAgKSBudW0gPSAwO1xuXG4gIHZhciBzcHJlYWQgPSBNYXRoLmZsb29yKDUxMCpudW0pIC0gMjU1O1xuXG4gIGlmKCBzcHJlYWQgPCAwICkgcmV0dXJuIFwiZmYwMFwiK3RvSGV4KDI1NStzcHJlYWQpO1xuICBlbHNlIGlmKCBzcHJlYWQgPiAwICkgcmV0dXJuIHRvSGV4KDI1NS1zcHJlYWQpK1wiMDBmZlwiO1xuICBlbHNlIHJldHVybiBcImZmZmYwMFwiO1xufTtcblxubW9kdWxlLmV4cG9ydHMudG9IZXggPSBmdW5jdGlvbihudW0pIHtcbiAgbnVtID0gbnVtLnRvU3RyaW5nKDE2KTtcbiAgaWYoIG51bS5sZW5ndGggPT0gMSApIG51bSA9IFwiMFwiK251bTtcbiAgcmV0dXJuIG51bTtcbn07XG4iXX0=
