(function(f){if(typeof exports==="object"&&typeof module!=="undefined"){module.exports=f()}else if(typeof define==="function"&&define.amd){define([],f)}else{var g;if(typeof window!=="undefined"){g=window}else if(typeof global!=="undefined"){g=global}else if(typeof self!=="undefined"){g=self}else{g=this}g.DWRAT = f()}})(function(){var define,module,exports;return (function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
var data = {
  all : [],
  noDemand : [],
  features : []
};

module.exports.set = function(points) {
  data.app = points;

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
  createGeoJson : createGeoJson
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

var file, map;

module.exports.init = function(options) {
  file = options.file;
  map = options.map;
};

// process a file
module.exports.run = function(e) {
  e.stopPropagation();
  e.preventDefault();
  var files = e.dataTransfer ? e.dataTransfer.files : e.target.files; // FileList object.

  if( files.length > 0 ) {
    $('#file-locate').html('Loading file...');
    read(files[0], function(err, data){
      $('#file-locate').html('');
      matchCols(data, function(colMap){
        // now locate data and create
        file.createGeoJson(data, colMap, function(){

          $('#date-selection').hide();
          $('#file-selection').html(files[0].name+' <a class="btn btn-default" id="remove-file-btn"><i class="fa fa-times"></i></a>');

          $('#remove-file-btn').on('click',function(){
            map.clearGeojsonLayer();
            $('#date-selection').show();
            $('#file-selection').html('');
          });

          $('#file-input').val('');
          $('#file-modal').modal('hide');
        });
      });
    });
  }
};

function read(raw, callback) {
    _resetUI();

    var type = 'text';

    var reader = new FileReader();
    reader.onload = function(e) {
        parse(type, e.target.result, callback);
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
        } else if( flatten.indexOf(key) == -1 && file.HEADERS[key].required ) {
            requiredMismatches.push(key);
        } else if( flatten.indexOf(key) > -1 ) {
            matches.push(key);
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
    huc = points[i].properties['HUC-12'] || points[i].properties.huc_12;

    if( pointsByHuc[huc] ) pointsByHuc[huc].push(points[i]);
    else pointsByHuc[huc] = [points[i]];
  }

  // request missing huc geojson and/or render huc
  for( var huc in pointsByHuc ) {
    if( huc === undefined || huc === 'undefined' ) debugger;

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
  render : render
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
    map : map
  });
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
var DroughtIcon = require('../markers/droughtIcon');
var markerConfig = require('../markers/config');
var markers = markerConfig.defaults;
var map;

module.exports.init = function(m) {
  map = m;

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
    if( geoJsonLayer ) {
      map.removeLayer(geoJsonLayer);
      geoJsonLayer = null;
      allData = [];
    }

    addGeoJson(lastRespPoints);
  });
};

module.exports.redrawPDemandLegend = function() {
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

function onRenderTypeChange() {
  var isFilledChecked = $('#renderTypeFilled').is(':checked');
  var newVal = isFilledChecked ? 'filled' : 'empty';

  if( renderDemand == newVal ) return;
  renderDemand = newVal;

  // render legend
  this.redrawPDemandLegend();

  if( !currentPoints ) return;

  if( geoJsonLayer ) {
    map.removeLayer(geoJsonLayer);
    geoJsonLayer = null;
    allData = [];
  }
  map.addGeoJson(currentPoints);
};

function stamp(data) {
  var template = markerTemplate;
  for( var key in data ) template = template.replace('{{'+key+'}}', data[key]);
  return template;
}

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
};

module.exports.clearGeojsonLayer = function() {
  geojson.clearLayer();
};
module.exports.getLeaflet = function() {
  return map;
};

},{"../legend":11,"./geojson":13}],15:[function(require,module,exports){
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

  if( options.renderDemand == 'filled' ) {

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

module.exports.percentDemandHuc = function(options) {
  if( options.percent == -1 ) {
     return {
       fillColor : '#ffffff',
       fillOpacity : 0.2,
       weight : 1,
       color: '#333333'
     };
  }


  if( options.renderDemand == 'filled' ) {

    if( options.percent <= 0 ) {

      return {
        fillColor : '#333333',
        fillOpacity : 0.3,
        weight : 2,
        color: '#333333'
      };


    } else {
      var o = options.percent;
      if( o > 0.8 ) o = 0.8;

      return {
        fillColor : '#0000ff',
        fillOpacity : o,
        weight : 2,
        color: '#333333'
      };
    }

  } else {

    if( options.percent >= 1 ) {

      return {
        fillColor : '#333333',
        fillOpacity : 0.3,
        weight : 2,
        color: '#333333'
      };

    } else {
      var o = 1 - options.percent;
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
//# sourceMappingURL=data:application/json;charset:utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9ncnVudC1icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJsaWIvc2hhcmVkL2RhdGFzdG9yZS9pbmRleC5qcyIsImxpYi9zaGFyZWQvZmlsZS9pbmRleC5qcyIsImxpYi9zaGFyZWQvZmlsZS9wYXJzZS5qcyIsImxpYi9zaGFyZWQvZmlsZS9wcm9jZXNzLmpzIiwibGliL3NoYXJlZC9maWxlL3NldHVwLmpzIiwibGliL3NoYXJlZC9odWMvaW5kZXguanMiLCJsaWIvc2hhcmVkL2luZGV4LmpzIiwibGliL3NoYXJlZC9sZWFmbGV0L2NhbnZhcy5qcyIsImxpYi9zaGFyZWQvbGVhZmxldC9kd3JhdC5qcyIsImxpYi9zaGFyZWQvbGVhZmxldC9pbmRleC5qcyIsImxpYi9zaGFyZWQvbGVnZW5kL2luZGV4LmpzIiwibGliL3NoYXJlZC9saWJyYXJ5L2luZGV4LmpzIiwibGliL3NoYXJlZC9tYXAvZ2VvanNvbi5qcyIsImxpYi9zaGFyZWQvbWFwL2luZGV4LmpzIiwibGliL3NoYXJlZC9tYXJrZXJzL2NvbmZpZy5qcyIsImxpYi9zaGFyZWQvbWFya2Vycy9kcm91Z2h0SWNvbi5qcyIsImxpYi9zaGFyZWQvbWFya2Vycy9pY29uUmVuZGVyZXIuanMiLCJsaWIvc2hhcmVkL21hcmtlcnMvdXRpbHMuanMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7QUNBQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNwQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDcktBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNwRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN4SUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN4Q0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDMUlBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMzREE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ25DQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDcEJBO0FBQ0E7QUFDQTs7QUNGQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDdElBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDbENBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN0SUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDL0RBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2xLQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNyQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDbkRBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EiLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXNDb250ZW50IjpbIihmdW5jdGlvbiBlKHQsbixyKXtmdW5jdGlvbiBzKG8sdSl7aWYoIW5bb10pe2lmKCF0W29dKXt2YXIgYT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2lmKCF1JiZhKXJldHVybiBhKG8sITApO2lmKGkpcmV0dXJuIGkobywhMCk7dmFyIGY9bmV3IEVycm9yKFwiQ2Fubm90IGZpbmQgbW9kdWxlICdcIitvK1wiJ1wiKTt0aHJvdyBmLmNvZGU9XCJNT0RVTEVfTk9UX0ZPVU5EXCIsZn12YXIgbD1uW29dPXtleHBvcnRzOnt9fTt0W29dWzBdLmNhbGwobC5leHBvcnRzLGZ1bmN0aW9uKGUpe3ZhciBuPXRbb11bMV1bZV07cmV0dXJuIHMobj9uOmUpfSxsLGwuZXhwb3J0cyxlLHQsbixyKX1yZXR1cm4gbltvXS5leHBvcnRzfXZhciBpPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7Zm9yKHZhciBvPTA7bzxyLmxlbmd0aDtvKyspcyhyW29dKTtyZXR1cm4gc30pIiwidmFyIGRhdGEgPSB7XG4gIGFsbCA6IFtdLFxuICBub0RlbWFuZCA6IFtdLFxuICBmZWF0dXJlcyA6IFtdXG59O1xuXG5tb2R1bGUuZXhwb3J0cy5zZXQgPSBmdW5jdGlvbihwb2ludHMpIHtcbiAgZGF0YS5hcHAgPSBwb2ludHM7XG5cbiAgdG1wID0gW107XG4gIGZvciggdmFyIGkgPSBwb2ludHMubGVuZ3RoLTE7IGkgPj0gMDsgaS0tICkge1xuICAgIGlmKCBwb2ludHNbaV0ucHJvcGVydGllcy5hbGxvY2F0aW9ucyAmJiBwb2ludHNbaV0ucHJvcGVydGllcy5hbGxvY2F0aW9ucy5sZW5ndGggPiAwICkge1xuXG4gICAgICB2YXIgZGVtYW5kID0gcG9pbnRzW2ldLnByb3BlcnRpZXMuYWxsb2NhdGlvbnNbMF0uZGVtYW5kO1xuICAgICAgaWYoIGRlbWFuZCAhPT0gMCApIHRtcC5wdXNoKHBvaW50c1tpXSk7XG4gICAgfVxuICB9XG4gIGRhdGEubm9EZW1hbmQgPSB0bXA7XG59O1xuXG5tb2R1bGUuZXhwb3J0cy5nZXQgPSBmdW5jdGlvbihub0RlbWFuZCkge1xuICBpZiggbm9EZW1hbmQgKSByZXR1cm4gZGF0YS5ub0RlbWFuZDtcbiAgcmV0dXJuIGRhdGEuYWxsO1xufTtcblxubW9kdWxlLmV4cG9ydHMuY2xlYXJGZWF0dXJlcyA9IGZ1bmN0aW9uKCl7XG4gIGRhdGEuZmVhdHVyZXMgPSBbXTtcbn07XG5cbm1vZHVsZS5leHBvcnRzLmFkZEZlYXR1cmUgPSBmdW5jdGlvbihmZWF0dXJlKSB7XG4gIGRhdGEuZmVhdHVyZXMucHVzaChmZWF0dXJlKTtcbn07XG5cbm1vZHVsZS5leHBvcnRzLmdldEZlYXR1cmVzID0gZnVuY3Rpb24oKSB7XG4gIHJldHVybiBkYXRhLmZlYXR1cmVzO1xufTtcbiIsInZhciBwcm9jZXNzID0gcmVxdWlyZSgnLi9wcm9jZXNzJyk7XG5cbnZhciBIRUFERVJTID0ge1xuICAgIGFwcGxpY2F0aW9uX251bWJlciA6IHtcbiAgICAgICAgcmVxdWlyZWQgOiB0cnVlLFxuICAgICAgICB0eXBlIDogJ3N0cmluZydcbiAgICB9LFxuICAgIGRlbWFuZF9kYXRlIDoge1xuICAgICAgICByZXF1aXJlZCA6IHRydWUsXG4gICAgICAgIHR5cGUgOiAnZGF0ZS1zdHJpbmcnXG4gICAgfSxcbiAgICB3YXRlcnNoZWQgOiB7XG4gICAgICAgIHJlcXVpcmVkIDogZmFsc2UsXG4gICAgICAgIHR5cGUgOiAnc3RyaW5nJ1xuICAgIH0sXG4gICAgc2Vhc29uIDoge1xuICAgICAgICByZXF1aXJlZCA6IGZhbHNlLFxuICAgICAgICB0eXBlIDogJ2Jvb2xlYW4nLFxuICAgIH0sXG4gICAgJ2h1Yy0xMicgOiB7XG4gICAgICAgIHJlcXVpcmVkIDogZmFsc2UsXG4gICAgICAgIHR5cGUgOiAnYm9vbGVhbidcbiAgICB9LFxuICAgIHdhdGVyX3JpZ2h0X3R5cGUgOiB7XG4gICAgICAgIHJlcXVpcmVkIDogZmFsc2UsXG4gICAgICAgIHR5cGUgOiAnc3RyaW5nJ1xuICAgIH0sXG4gICAgcHJpb3JpdHlfZGF0ZSA6IHtcbiAgICAgICAgcmVxdWlyZWQgOiB0cnVlLFxuICAgICAgICB0eXBlIDogJ2RhdGUtc3RyaW5nJ1xuICAgIH0sXG4gICAgcmlwYXJpYW4gOiB7XG4gICAgICAgIHJlcXVpcmVkIDogZmFsc2UsXG4gICAgICAgIHR5cGUgOiAnYm9vbGVhbidcbiAgICB9LFxuICAgIHByZTE5MTQgOiB7XG4gICAgICAgIHJlcXVpcmVkIDogZmFsc2UsXG4gICAgICAgIHR5cGUgOiAnYm9vbGVhbidcbiAgICB9LFxuICAgIGRlbWFuZCA6IHtcbiAgICAgICAgcmVxdWlyZWQgOiB0cnVlLFxuICAgICAgICB0eXBlIDogJ2Zsb2F0J1xuICAgIH0sXG4gICAgYWxsb2NhdGlvbiA6IHtcbiAgICAgICAgcmVxdWlyZWQgOiB0cnVlLFxuICAgICAgICB0eXBlIDogJ2Zsb2F0J1xuICAgIH1cbn07XG5cbnZhciBsb2NhdGlvbnMgPSB7fSwgbWFwLCBkYXRhc3RvcmU7XG5cblxuZnVuY3Rpb24gY3JlYXRlR2VvSnNvbihkYXRhLCBhdHRyTWFwLCBjYWxsYmFjaykge1xuICAgIC8vIGZpcnN0IGxvY2F0ZSBkYXRhXG4gICAgJCgnI2ZpbGUtbG9jYXRlJykuaHRtbCgnTG9jYXRpbmcgZGF0YS4uLicpO1xuXG4gICAgdmFyIGlkcyA9IFtdLCBrZXk7XG4gICAgdmFyIGNvbCA9IGdldEF0dHJDb2woJ2FwcGxpY2F0aW9uX251bWJlcicsIGRhdGEsIGF0dHJNYXApO1xuICAgIGZvciggdmFyIGkgPSAxOyBpIDwgZGF0YS5sZW5ndGg7IGkrKyApIHtcbiAgICAgICAgdmFyIGlkID0gZGF0YVtpXVtjb2xdO1xuICAgICAgICBpZiggIWxvY2F0aW9uc1tpZF0gKSBpZHMucHVzaChkYXRhW2ldW2NvbF0pO1xuICAgIH1cblxuICAgIGxvY2F0ZURhdGEoMCwgaWRzLCBmdW5jdGlvbigpe1xuXG4gICAgICAgICQoJyNmaWxlLWxvY2F0ZScpLmh0bWwoJ0NyZWF0aW5nIGRhdGEuLi4nKTtcblxuICAgICAgICB2YXIgaU1hcCA9IHt9O1xuICAgICAgICBmb3IoIGtleSBpbiBhdHRyTWFwICkgaU1hcFthdHRyTWFwW2tleV1dID0ga2V5O1xuXG4gICAgICAgIHZhciBnZW9Kc29uID0gW107XG4gICAgICAgIGZvciggdmFyIGkgPSAxOyBpIDwgZGF0YS5sZW5ndGg7IGkrKyApIHtcbiAgICAgICAgICAgIGlmKCAhbG9jYXRpb25zW2RhdGFbaV1bY29sXV0gKSBjb250aW51ZTtcblxuICAgICAgICAgICAgdmFyIHAgPSB7XG4gICAgICAgICAgICAgICAgdHlwZSA6ICdGZWF0dXJlJyxcbiAgICAgICAgICAgICAgICBnZW9tZXRyeSA6ICQuZXh0ZW5kKHt9LCB0cnVlLCBsb2NhdGlvbnNbZGF0YVtpXVtjb2xdXSksXG4gICAgICAgICAgICAgICAgcHJvcGVydGllcyA6IHt9XG4gICAgICAgICAgICB9O1xuXG4gICAgICAgICAgICBmb3IoIHZhciBqID0gMDsgaiA8IGRhdGFbMF0ubGVuZ3RoOyBqKysgKSB7XG4gICAgICAgICAgICAgICAga2V5ID0gZGF0YVswXVtqXTtcbiAgICAgICAgICAgICAgICBpZiggaU1hcFtrZXldICkga2V5ID0gaU1hcFtrZXldO1xuICAgICAgICAgICAgICAgIHAucHJvcGVydGllc1trZXldID0gKEhFQURFUlNba2V5XSAmJiBIRUFERVJTW2tleV0udHlwZSA9PSAnZmxvYXQnKSA/IHBhcnNlRmxvYXQoZGF0YVtpXVtqXSkgOiBkYXRhW2ldW2pdO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBwLnByb3BlcnRpZXMuYWxsb2NhdGlvbnMgPSBbe1xuICAgICAgICAgICAgICAgIHNlYXNvbiA6IHRydWUsXG4gICAgICAgICAgICAgICAgYWxsb2NhdGlvbiA6IHAucHJvcGVydGllcy5hbGxvY2F0aW9uLFxuICAgICAgICAgICAgICAgIGRlbWFuZCA6IHAucHJvcGVydGllcy5kZW1hbmQsXG4gICAgICAgICAgICAgICAgZm9yZWNhc3QgOiBmYWxzZSxcbiAgICAgICAgICAgICAgICBkYXRlIDogcC5wcm9wZXJ0aWVzLmRlbWFuZF9kYXRlLFxuICAgICAgICAgICAgICAgIHB1YmxpY19oZWFsdGhfYmluZCA6IGZhbHNlLFxuICAgICAgICAgICAgICAgIHdyYmluZCA6IGZhbHNlLFxuICAgICAgICAgICAgICAgIHJhdGlvIDogKHAucHJvcGVydGllcy5kZW1hbmQgPiAwKSA/IChwLnByb3BlcnRpZXMuYWxsb2NhdGlvbiAvIHAucHJvcGVydGllcy5kZW1hbmQpIDogMFxuICAgICAgICAgICAgfV07XG5cbiAgICAgICAgICAgIGdlb0pzb24ucHVzaChwKTtcbiAgICAgICAgfVxuXG4gICAgICAgIG1hcC5jbGVhckdlb2pzb25MYXllcigpO1xuICAgICAgICBkYXRhc3RvcmUuc2V0KGdlb0pzb24pO1xuICAgICAgICBtYXAuZ2VvanNvbi5hZGQoZ2VvSnNvbik7XG5cbiAgICAgICAgJCgnI2ZpbGUtbG9jYXRlJykuaHRtbCgnJyk7XG4gICAgICAgIGNhbGxiYWNrKCk7XG4gICAgfSk7XG59XG5cbmZ1bmN0aW9uIGdldEF0dHJDb2woYXR0ciwgZGF0YSwgbWFwKSB7XG4gICAgaWYoIG1hcFthdHRyXSApIHJldHVybiBkYXRhWzBdLmluZGV4T2YobWFwW2F0dHJdKTtcbiAgICByZXR1cm4gZGF0YVswXS5pbmRleE9mKGF0dHIpO1xufVxuXG5mdW5jdGlvbiBsb2NhdGVEYXRhKGluZGV4LCBpZHMsIGNhbGxiYWNrKSB7XG4gICAgaWYoIGluZGV4KzEgPj0gaWRzLmxlbmd0aCApIHtcbiAgICAgICAgY2FsbGJhY2soKTtcbiAgICB9IGVsc2Uge1xuICAgICAgICB2YXIgaWRHcm91cCA9IFtdO1xuXG4gICAgICAgIHZhciBpID0gMDtcbiAgICAgICAgZm9yKCBpID0gaW5kZXg7IGkgPCBpbmRleCsyMDA7IGkrKyApIHtcbiAgICAgICAgICAgIGlmKCBpZHMubGVuZ3RoID09IGkgKSBicmVhaztcbiAgICAgICAgICAgIGlkR3JvdXAucHVzaChpZHNbaV0pO1xuICAgICAgICB9XG4gICAgICAgIGluZGV4ICs9IDIwMDtcbiAgICAgICAgY29uc29sZS5sb2coaW5kZXgpO1xuXG5cblxuICAgICAgICB2YXIgcXVlcnkgPSBuZXcgZ29vZ2xlLnZpc3VhbGl6YXRpb24uUXVlcnkoJ2h0dHA6Ly93YXRlcnNoZWQuaWNlLnVjZGF2aXMuZWR1L3ZpenNvdXJjZS9yZXN0P3ZpZXc9bG9jYXRlKFxcJycrXG4gICAgICAgICAgICBpZEdyb3VwLmpvaW4oJywnKSsnXFwnKSZ0cT1TRUxFQ1QgKicpO1xuICAgICAgICBxdWVyeS5zZW5kKGZ1bmN0aW9uKHJlc3Ape1xuICAgICAgICAgICAgaWYoIHJlc3AuaXNFcnJvcigpICkge1xuICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKHJlc3AuZ2V0TWVzc2FnZSgpKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgdmFyIGR0ID0gcmVzcC5nZXREYXRhVGFibGUoKTtcbiAgICAgICAgICAgICAgICBmb3IoIHZhciBpID0gMDsgaSA8IGR0LmdldE51bWJlck9mUm93cygpOyBpKysgKSB7XG4gICAgICAgICAgICAgICAgICAgIGxvY2F0aW9uc1tkdC5nZXRWYWx1ZShpLCAwKV0gPSBKU09OLnBhcnNlKGR0LmdldFZhbHVlKGksIDIpKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICQoJyNmaWxlLWxvY2F0ZScpLmh0bWwoJ0xvY2F0aW5nIGRhdGEgJysoKGluZGV4L2lkcy5sZW5ndGgpLnRvRml4ZWQoMikqMTAwKSsnJS4uLicpO1xuICAgICAgICAgICAgbG9jYXRlRGF0YShpbmRleCwgaWRzLCBjYWxsYmFjayk7XG4gICAgICAgIH0pO1xuICAgIH1cbn1cblxuXG5cbnZhciBmaWxlID0ge1xuICBIRUFERVJTIDogSEVBREVSUyxcbiAgaW5pdCA6IGZ1bmN0aW9uKG9wdGlvbnMpe1xuICAgIG1hcCA9IG9wdGlvbnMubWFwO1xuICAgIGRhdGFzdG9yZSA9IG9wdGlvbnMuZGF0YXN0b3JlO1xuICAgIG9wdGlvbnMuZmlsZSA9IHRoaXM7XG5cbiAgICByZXF1aXJlKCcuL3NldHVwJykocHJvY2Vzcyk7XG4gICAgcHJvY2Vzcy5pbml0KG9wdGlvbnMpO1xuICB9LFxuICBjcmVhdGVHZW9Kc29uIDogY3JlYXRlR2VvSnNvblxufTtcblxuXG5tb2R1bGUuZXhwb3J0cyA9IGZpbGU7XG4iLCJtb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uKHR5cGUsIGNvbnRlbnRzLCBjYWxsYmFjaykge1xuICAgIGlmKCB0eXBlID09ICd4bHN4JyApIHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGZ1bmN0aW9uIG9uWGxzeENvbXBsZXRlKHdiKXtcbiAgICAgICAgICAgICAgICBzZWxlY3RXb3Jrc2hlZXQod2IuU2hlZXROYW1lcywgZnVuY3Rpb24oc2hlZXROYW1lKXtcbiAgICAgICAgICAgICAgICAgICAgdmFyIGNzdiA9IFhMU1gudXRpbHMuc2hlZXRfdG9fY3N2KHdiLlNoZWV0c1tzaGVldE5hbWVdKTtcbiAgICAgICAgICAgICAgICAgICAgJC5jc3YudG9BcnJheXMoY3N2LCB7fSwgZnVuY3Rpb24oZXJyLCBkYXRhKXtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmKCBlcnIgKSByZXR1cm4gY2FsbGJhY2soZXJyKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNhbGxiYWNrKG51bGwsIGRhdGEpO1xuICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgdmFyIHdvcmtlciA9IG5ldyBXb3JrZXIoJ2Jvd2VyX2NvbXBvbmVudHMvanMteGxzeC94bHN4d29ya2VyLmpzJyk7XG4gICAgICAgICAgICB3b3JrZXIub25tZXNzYWdlID0gZnVuY3Rpb24oZSkge1xuICAgICAgICAgICAgICAgIHN3aXRjaChlLmRhdGEudCkge1xuICAgICAgICAgICAgICAgICAgICBjYXNlICdyZWFkeSc6IGJyZWFrO1xuICAgICAgICAgICAgICAgICAgICBjYXNlICdlJzogY29uc29sZS5lcnJvcihlLmRhdGEuZCk7IGJyZWFrO1xuICAgICAgICAgICAgICAgICAgICBjYXNlICd4bHN4Jzogb25YbHN4Q29tcGxldGUoSlNPTi5wYXJzZShlLmRhdGEuZCkpOyBicmVhaztcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9O1xuICAgICAgICAgICAgd29ya2VyLnBvc3RNZXNzYWdlKHtkOmNvbnRlbnRzLGI6dHJ1ZX0pO1xuXG4gICAgICAgIH0gY2F0Y2goZSkge1xuICAgICAgICAgICAgY2FsbGJhY2soZSk7XG4gICAgICAgIH1cblxuICAgIH0gZWxzZSBpZiggaW5mby5leHQgPT0gJ3hscycgKSB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBmdW5jdGlvbiBvblhsc0NvbXBsZXRlKHdiKXtcbiAgICAgICAgICAgICAgICBzZWxlY3RXb3Jrc2hlZXQod2IuU2hlZXROYW1lcywgZnVuY3Rpb24oc2hlZXROYW1lKXtcbiAgICAgICAgICAgICAgICAgICAgdmFyIGNzdiA9IFhMUy51dGlscy5zaGVldF90b19jc3Yod2IuU2hlZXRzW3NoZWV0TmFtZV0pO1xuICAgICAgICAgICAgICAgICAgICAkLmNzdi50b0FycmF5cyhjc3YsIHt9LCBmdW5jdGlvbihlcnIsIGRhdGEpe1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYoIGVyciApIHJldHVybiBjYWxsYmFjayhlcnIpO1xuICAgICAgICAgICAgICAgICAgICAgICAgY2FsbGJhY2sobnVsbCwgZGF0YSk7XG4gICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICB2YXIgd29ya2VyID0gbmV3IFdvcmtlcignYm93ZXJfY29tcG9uZW50cy9qcy14bHMveGxzd29ya2VyLmpzJyk7XG4gICAgICAgICAgICB3b3JrZXIub25tZXNzYWdlID0gZnVuY3Rpb24oZSkge1xuICAgICAgICAgICAgICAgIHN3aXRjaChlLmRhdGEudCkge1xuICAgICAgICAgICAgICAgICAgICBjYXNlICdyZWFkeSc6IGJyZWFrO1xuICAgICAgICAgICAgICAgICAgICBjYXNlICdlJzogY29uc29sZS5lcnJvcihlLmRhdGEuZCk7IGJyZWFrO1xuICAgICAgICAgICAgICAgICAgICBjYXNlICd4bHN4Jzogb25YbHNDb21wbGV0ZShKU09OLnBhcnNlKGUuZGF0YS5kKSk7IGJyZWFrO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH07XG4gICAgICAgICAgICB3b3JrZXIucG9zdE1lc3NhZ2Uoe2Q6Y29udGVudHMsYjp0cnVlfSk7XG5cbiAgICAgICAgfSBjYXRjaChlKSB7XG4gICAgICAgICAgICBkZWJ1Z2dlcjtcbiAgICAgICAgICAgIHRoaXMub25Db21wbGV0ZShlLCBudWxsLCBpbmZvLCAxLCAxLCBhcnIsIGNhbGxiYWNrKTtcbiAgICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICB2YXIgb3B0aW9ucyA9IHt9O1xuICAgICAgICAgICAgLy9pZiggaW5mby5wYXJzZXIgPT0gJ2Nzdi10YWInICkgb3B0aW9ucy5zZXBhcmF0b3IgPSAnXFx0JztcblxuICAgICAgICAgICAgJC5jc3YudG9BcnJheXMoY29udGVudHMsIG9wdGlvbnMsIGZ1bmN0aW9uKGVyciwgZGF0YSl7XG4gICAgICAgICAgICAgICAgaWYoIGVyciApIHJldHVybiBjYWxsYmFjayhlcnIpO1xuICAgICAgICAgICAgICAgIGNhbGxiYWNrKG51bGwsIGRhdGEpO1xuICAgICAgICAgICAgfS5iaW5kKHRoaXMpKTtcbiAgICAgICAgfSBjYXRjaChlKSB7XG4gICAgICAgICAgICBkZWJ1Z2dlcjtcbiAgICAgICAgICAgIHRoaXMub25Db21wbGV0ZShlLCBudWxsLCBpbmZvLCAxLCAxLCBhcnIsIGNhbGxiYWNrKTtcbiAgICAgICAgfVxuICAgIH1cbn1cbiIsInZhciBwYXJzZSA9IHJlcXVpcmUoJy4vcGFyc2UnKTtcbnZhciBwcmV2aW91c0F0dHJNYXAgPSB7fTtcblxudmFyIGZpbGUsIG1hcDtcblxubW9kdWxlLmV4cG9ydHMuaW5pdCA9IGZ1bmN0aW9uKG9wdGlvbnMpIHtcbiAgZmlsZSA9IG9wdGlvbnMuZmlsZTtcbiAgbWFwID0gb3B0aW9ucy5tYXA7XG59O1xuXG4vLyBwcm9jZXNzIGEgZmlsZVxubW9kdWxlLmV4cG9ydHMucnVuID0gZnVuY3Rpb24oZSkge1xuICBlLnN0b3BQcm9wYWdhdGlvbigpO1xuICBlLnByZXZlbnREZWZhdWx0KCk7XG4gIHZhciBmaWxlcyA9IGUuZGF0YVRyYW5zZmVyID8gZS5kYXRhVHJhbnNmZXIuZmlsZXMgOiBlLnRhcmdldC5maWxlczsgLy8gRmlsZUxpc3Qgb2JqZWN0LlxuXG4gIGlmKCBmaWxlcy5sZW5ndGggPiAwICkge1xuICAgICQoJyNmaWxlLWxvY2F0ZScpLmh0bWwoJ0xvYWRpbmcgZmlsZS4uLicpO1xuICAgIHJlYWQoZmlsZXNbMF0sIGZ1bmN0aW9uKGVyciwgZGF0YSl7XG4gICAgICAkKCcjZmlsZS1sb2NhdGUnKS5odG1sKCcnKTtcbiAgICAgIG1hdGNoQ29scyhkYXRhLCBmdW5jdGlvbihjb2xNYXApe1xuICAgICAgICAvLyBub3cgbG9jYXRlIGRhdGEgYW5kIGNyZWF0ZVxuICAgICAgICBmaWxlLmNyZWF0ZUdlb0pzb24oZGF0YSwgY29sTWFwLCBmdW5jdGlvbigpe1xuXG4gICAgICAgICAgJCgnI2RhdGUtc2VsZWN0aW9uJykuaGlkZSgpO1xuICAgICAgICAgICQoJyNmaWxlLXNlbGVjdGlvbicpLmh0bWwoZmlsZXNbMF0ubmFtZSsnIDxhIGNsYXNzPVwiYnRuIGJ0bi1kZWZhdWx0XCIgaWQ9XCJyZW1vdmUtZmlsZS1idG5cIj48aSBjbGFzcz1cImZhIGZhLXRpbWVzXCI+PC9pPjwvYT4nKTtcblxuICAgICAgICAgICQoJyNyZW1vdmUtZmlsZS1idG4nKS5vbignY2xpY2snLGZ1bmN0aW9uKCl7XG4gICAgICAgICAgICBtYXAuY2xlYXJHZW9qc29uTGF5ZXIoKTtcbiAgICAgICAgICAgICQoJyNkYXRlLXNlbGVjdGlvbicpLnNob3coKTtcbiAgICAgICAgICAgICQoJyNmaWxlLXNlbGVjdGlvbicpLmh0bWwoJycpO1xuICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgJCgnI2ZpbGUtaW5wdXQnKS52YWwoJycpO1xuICAgICAgICAgICQoJyNmaWxlLW1vZGFsJykubW9kYWwoJ2hpZGUnKTtcbiAgICAgICAgfSk7XG4gICAgICB9KTtcbiAgICB9KTtcbiAgfVxufTtcblxuZnVuY3Rpb24gcmVhZChyYXcsIGNhbGxiYWNrKSB7XG4gICAgX3Jlc2V0VUkoKTtcblxuICAgIHZhciB0eXBlID0gJ3RleHQnO1xuXG4gICAgdmFyIHJlYWRlciA9IG5ldyBGaWxlUmVhZGVyKCk7XG4gICAgcmVhZGVyLm9ubG9hZCA9IGZ1bmN0aW9uKGUpIHtcbiAgICAgICAgcGFyc2UodHlwZSwgZS50YXJnZXQucmVzdWx0LCBjYWxsYmFjayk7XG4gICAgfTtcblxuICAgIGlmKCByYXcubmFtZS5tYXRjaCgvLipcXC54bHN4PyQvKSApIHtcbiAgICAgICAgdHlwZSA9IHJhdy5uYW1lLnJlcGxhY2UoLy4qXFwuLywnJyk7XG4gICAgICAgIHJlYWRlci5yZWFkQXNCaW5hcnlTdHJpbmcocmF3KTtcbiAgICB9IGVsc2Uge1xuICAgICAgICByZWFkZXIucmVhZEFzVGV4dChyYXcpO1xuICAgIH1cbn1cblxuZnVuY3Rpb24gbWF0Y2hDb2xzKGRhdGEsIGNhbGxiYWNrKSB7XG4gICAgaWYoIGRhdGEubGVuZ3RoID09IDAgKSByZXR1cm4gYWxlcnQoJ1lvdXIgZmlsZSBpcyBlbXB0eScpO1xuXG4gICAgdmFyIG1hdGNoZXMgPSBbXTtcbiAgICB2YXIgcmVxdWlyZWRNaXNtYXRjaGVzID0gW107XG4gICAgdmFyIG1hcHBlZCA9IHByZXZpb3VzQXR0ck1hcDtcblxuICAgIHZhciBmbGF0dGVuID0gW107XG4gICAgZm9yKCB2YXIgaSA9IDA7IGkgPCBkYXRhWzBdLmxlbmd0aDsgaSsrICkge1xuICAgICAgZmxhdHRlbi5wdXNoKGRhdGFbMF1baV0udG9Mb3dlckNhc2UoKSk7XG4gICAgfVxuXG4gICAgZm9yKCB2YXIga2V5IGluIGZpbGUuSEVBREVSUyApIHtcbiAgICAgICAgaWYoIHByZXZpb3VzQXR0ck1hcFtrZXldICkge1xuICAgICAgICAgICAgbWF0Y2hlcy5wdXNoKGtleSk7XG4gICAgICAgIH0gZWxzZSBpZiggZmxhdHRlbi5pbmRleE9mKGtleSkgPT0gLTEgJiYgZmlsZS5IRUFERVJTW2tleV0ucmVxdWlyZWQgKSB7XG4gICAgICAgICAgICByZXF1aXJlZE1pc21hdGNoZXMucHVzaChrZXkpO1xuICAgICAgICB9IGVsc2UgaWYoIGZsYXR0ZW4uaW5kZXhPZihrZXkpID4gLTEgKSB7XG4gICAgICAgICAgICBtYXRjaGVzLnB1c2goa2V5KTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGlmKCByZXF1aXJlZE1pc21hdGNoZXMubGVuZ3RoID09IDAgKSByZXR1cm4gY2FsbGJhY2socHJldmlvdXNBdHRyTWFwKTtcblxuICAgIHZhciB0YWJsZSA9ICc8dGFibGUgY2xhc3M9XCJ0YWJsZVwiPic7XG4gICAgZm9yKCB2YXIgaSA9IDA7IGkgPCByZXF1aXJlZE1pc21hdGNoZXMubGVuZ3RoOyBpKysgKSB7XG4gICAgICAgIHRhYmxlICs9ICc8dHI+PHRkPicrcmVxdWlyZWRNaXNtYXRjaGVzW2ldKyc8L3RkPjx0ZD4nK19jcmVhdGVNYXRjaFNlbGVjdG9yKHJlcXVpcmVkTWlzbWF0Y2hlc1tpXSwgZGF0YVswXSwgbWF0Y2hlcykrJzwvdGQ+PC90cj4nO1xuICAgIH1cbiAgICB0YWJsZSArPSAnPC90YWJsZT4nO1xuXG4gICAgJCgnI21hdGNoVGFibGUnKS5odG1sKCc8ZGl2IHN0eWxlPVwibWFyZ2luLXRvcDoyMHB4O2ZvbnQtd2VpZ2h0OmJvbGRcIj5QbGVhc2UgbWF0Y2ggdGhlIGZvbGxvd2luZyByZXF1aXJlZCBjb2x1bW5zIHRvIGNvbnRpbnVlPC9kaXY+Jyt0YWJsZSk7XG4gICAgJCgnLm1hdGNoLXNlbGVjdG9yJykub24oJ2NoYW5nZScsIGZ1bmN0aW9uKCl7XG4gICAgICAgIHZhciBrZXkgPSAkKHRoaXMpLmF0dHIoJ2tleScpO1xuICAgICAgICB2YXIgdmFsID0gJCh0aGlzKS52YWwoKTtcblxuICAgICAgICBpZiggdmFsID09ICcnIHx8ICF2YWwgKSB7XG4gICAgICAgICAgICBkZWxldGUgbWFwcGVkW2tleV07XG4gICAgICAgICAgICByZXF1aXJlZE1pc21hdGNoZXMucHVzaChrZXkpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgbWFwcGVkW2tleV0gPSB2YWw7XG4gICAgICAgICAgICB2YXIgaW5kZXggPSByZXF1aXJlZE1pc21hdGNoZXMuaW5kZXhPZihrZXkpO1xuICAgICAgICAgICAgaWYgKGluZGV4ID4gLTEpIHJlcXVpcmVkTWlzbWF0Y2hlcy5zcGxpY2UoaW5kZXgsIDEpO1xuICAgICAgICB9XG5cblxuICAgICAgICBpZiggcmVxdWlyZWRNaXNtYXRjaGVzLmxlbmd0aCA9PSAwICkge1xuICAgICAgICAgICAgJCgnI21hdGNoVGFibGUnKS5odG1sKCcnKTtcbiAgICAgICAgICAgIHByZXZpb3VzQXR0ck1hcCA9IG1hcHBlZDtcbiAgICAgICAgICAgIGNhbGxiYWNrKG1hcHBlZCk7XG4gICAgICAgIH1cbiAgICB9KTtcbn1cblxuXG5mdW5jdGlvbiBfcmVzZXRVSSgpIHtcbiAgICAkKCcjbWF0Y2hUYWJsZScpLmh0bWwoJycpO1xuICAgICQoJyNmaWxlLWxvY2F0ZScpLmh0bWwoJycpO1xufVxuXG5mdW5jdGlvbiBfY3JlYXRlTWF0Y2hTZWxlY3RvcihrZXksIGFyciwgbWF0Y2hlcykge1xuICAgIHZhciBzZWxlY3QgPSAnPHNlbGVjdCBjbGFzcz1cIm1hdGNoLXNlbGVjdG9yXCIga2V5PVwiJytrZXkrJ1wiPjxvcHRpb24+PC9vcHRpb24+JztcblxuICAgIGZvciggdmFyIGkgPSAwOyBpIDwgYXJyLmxlbmd0aDsgaSsrICkge1xuICAgICAgICBpZiggbWF0Y2hlcy5pbmRleE9mKGFycltpXSkgPiAtMSApIGNvbnRpbnVlO1xuICAgICAgICBzZWxlY3QgKz0gJzxvcHRpb24gdmFsdWU9XCInK2FycltpXSsnXCI+JythcnJbaV0rJzwvb3B0aW9uPic7XG4gICAgfVxuICAgIHJldHVybiBzZWxlY3QgKyAnPC9zZWxlY3Q+Jztcbn1cblxuZnVuY3Rpb24gc2VsZWN0V29ya3NoZWV0KHNoZWV0TmFtZXMsIGNhbGxiYWNrKSB7XG4gICAgY29uc29sZS5sb2coc2hlZXROYW1lcyk7XG5cbiAgICBpZiggc2hlZXROYW1lcy5sZW5ndGggPT0gMSApIGNhbGxiYWNrKHNoZWV0TmFtZXNbMF0pO1xuXG4gICAgLy8gYWRkIFVJIGludGVyYWN0aW9uIGhlcmVcbiAgICBjYWxsYmFjayhzaGVldE5hbWVzWzBdKTtcbn1cbiIsIm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24ocHJvY2Vzcykge1xuICAkKCcjY2xvc2UtcG9wdXAnKS5vbignY2xpY2snLCBmdW5jdGlvbigpe1xuICAgICQoJyNpbmZvJykucmVtb3ZlQ2xhc3MoJ2ZhZGVJbkRvd24nKS5hZGRDbGFzcygnc2xpZGVPdXRSaWdodCcpO1xuXG4gICAgc2VsZWN0KG51bGwpO1xuICAgIHNldFRpbWVvdXQoZnVuY3Rpb24oKXtcbiAgICAgICQoJyNpbmZvJykuaGlkZSgpLmFkZENsYXNzKCdmYWRlSW5Eb3duJykucmVtb3ZlQ2xhc3MoJ3NsaWRlT3V0UmlnaHQnKTtcbiAgICB9LCA4MDApO1xuICB9KTtcblxuICAvLyBmaWxlIHVwbG9hZCBzdHVmZlxuICAkKCcjZmlsZS1tb2RhbCcpLm1vZGFsKHtzaG93OmZhbHNlfSk7XG4gICQoJyNmaWxlLWlucHV0Jykub24oJ2NoYW5nZScsIGZ1bmN0aW9uKGUpIHtcbiAgICBwcm9jZXNzLnJ1bihlKTtcbiAgfSk7XG4gICQoJyN1cGxvYWQtYnRuJykub24oJ2NsaWNrJywgZnVuY3Rpb24oKXtcbiAgICAkKCcjZmlsZS1tb2RhbCcpLm1vZGFsKCdzaG93Jyk7XG4gIH0pO1xuXG4gICQoJ2JvZHknKS5vbignZHJhZ292ZXInLCBmdW5jdGlvbihlKXtcbiAgICBlLnByZXZlbnREZWZhdWx0KCk7XG4gICAgZS5zdG9wUHJvcGFnYXRpb24oKTtcblxuICAgICQoJyN1cGxvYWQtZHJvcC1tZXNzYWdlJykuc2hvdygpO1xuICAgICQoJyN3cmFwcGVyJykuY3NzKCdvcGFjaXR5JywgMC4zKTtcbiAgfSkub24oJ2RyYWdsZWF2ZScsIGZ1bmN0aW9uKGUpe1xuICAgIGUucHJldmVudERlZmF1bHQoKTtcbiAgICBlLnN0b3BQcm9wYWdhdGlvbigpO1xuXG4gICAgJCgnI3VwbG9hZC1kcm9wLW1lc3NhZ2UnKS5oaWRlKCk7XG4gICAgJCgnI3dyYXBwZXInKS5jc3MoJ29wYWNpdHknLDEpO1xuICB9KS5vbignZHJvcCcsIGZ1bmN0aW9uKGUpe1xuICAgICQoJyN1cGxvYWQtZHJvcC1tZXNzYWdlJykuaGlkZSgpO1xuICAgICQoJyN3cmFwcGVyJykuY3NzKCdvcGFjaXR5JywxKTtcblxuICAgIHByb2Nlc3MucnVuKGUub3JpZ2luYWxFdmVudCk7XG4gICAgJCgnI2ZpbGUtbW9kYWwnKS5tb2RhbCgnc2hvdycpO1xuXG4gIH0pO1xufTtcbiIsInZhciBtYXJrZXJDb25maWcgPSByZXF1aXJlKCcuLi9tYXJrZXJzL2NvbmZpZycpO1xuXG52YXIgbWFwO1xudmFyIGxheWVycyA9IFtdO1xudmFyIHBvaW50c0J5SHVjID0ge307XG52YXIgdXJsUHJlZml4ID0gJ2h0dHA6Ly93YXRlcnNoZWQuaWNlLnVjZGF2aXMuZWR1L3ZpenNvdXJjZS9yZXN0P3ZpZXc9Z2V0X2h1Y19ieV9pZChcXCcnO1xudmFyIHVybFBvc3RpeCA9ICdcXCcpJnRxPVNFTEVDVCAqJztcblxudmFyIGh1Y0NhY2hlID0ge307XG52YXIgcmVxdWVzdGVkID0ge307XG5cbnZhciBzaG93aW5nID0gdHJ1ZTtcbnZhciBjdXJyZW50UG9pbnRzID0gbnVsbDtcblxuZnVuY3Rpb24gaW5pdChvcHRpb25zKSB7XG4gIG1hcCA9IG9wdGlvbnMubWFwLmdldExlYWZsZXQoKTtcblxuICAkKCcjcmVuZGVySHVjQXZnJykub24oJ2NoYW5nZScsIGZ1bmN0aW9uKCl7XG4gICAgc2hvd2luZyA9ICQodGhpcykuaXMoJzpjaGVja2VkJyk7XG4gICAgb25WaXNpYmlsaXR5VXBkYXRlKHNob3dpbmcpO1xuICB9KTtcbn1cblxuZnVuY3Rpb24gb25WaXNpYmlsaXR5VXBkYXRlKCkge1xuICBpZiggIXNob3dpbmcgKSB7XG4gICAgY2xlYXIoKTtcbiAgfSBlbHNlIGlmKCBjdXJyZW50UG9pbnRzICE9PSBudWxsICl7XG4gICAgcmVuZGVyKGN1cnJlbnRQb2ludHMpO1xuICB9XG59XG5cbmZ1bmN0aW9uIGNsZWFyKCkge1xuICAvLyBjbGVhciBhbGwgbGF5ZXJzXG4gIGZvciggdmFyIGkgPSAwOyBpIDwgbGF5ZXJzLmxlbmd0aDsgaSsrICkge1xuICAgIG1hcC5yZW1vdmVMYXllcihsYXllcnNbaV0pO1xuICB9XG4gIGxheWVycyA9IFtdO1xuICBwb2ludHNCeUh1YyA9IHt9O1xufVxuXG5mdW5jdGlvbiByZW5kZXIocG9pbnRzKSB7XG4gIGN1cnJlbnRQb2ludHMgPSBwb2ludHM7XG4gIGlmKCAhc2hvd2luZyApIHJldHVybjtcblxuICBjbGVhcigpO1xuXG4gIC8vIG9yZ2FuaXplIHBvaW50cyBieSBodWNcbiAgdmFyIGh1YztcbiAgZm9yKCB2YXIgaSA9IDA7IGkgPCBjdXJyZW50UG9pbnRzLmxlbmd0aDsgaSsrICkge1xuICAgIC8vIFRPRE86IGRpZCBxdWlubiBjaGFuZ2UgdGhpcz9cbiAgICBodWMgPSBwb2ludHNbaV0ucHJvcGVydGllc1snSFVDLTEyJ10gfHwgcG9pbnRzW2ldLnByb3BlcnRpZXMuaHVjXzEyO1xuXG4gICAgaWYoIHBvaW50c0J5SHVjW2h1Y10gKSBwb2ludHNCeUh1Y1todWNdLnB1c2gocG9pbnRzW2ldKTtcbiAgICBlbHNlIHBvaW50c0J5SHVjW2h1Y10gPSBbcG9pbnRzW2ldXTtcbiAgfVxuXG4gIC8vIHJlcXVlc3QgbWlzc2luZyBodWMgZ2VvanNvbiBhbmQvb3IgcmVuZGVyIGh1Y1xuICBmb3IoIHZhciBodWMgaW4gcG9pbnRzQnlIdWMgKSB7XG4gICAgaWYoIGh1YyA9PT0gdW5kZWZpbmVkIHx8IGh1YyA9PT0gJ3VuZGVmaW5lZCcgKSBkZWJ1Z2dlcjtcblxuICAgIGlmKCBodWNDYWNoZVtodWNdICkgcmVuZGVySHVjKGh1Yyk7XG4gICAgZWxzZSBpZiggIXJlcXVlc3RlZFtodWNdICkgcmVxdWVzdChodWMpO1xuICB9XG59XG5cbmZ1bmN0aW9uIHJlcXVlc3QoaHVjSWQpIHtcbiAgcmVxdWVzdGVkW2h1Y0lkXSA9IDE7XG5cbiAgdmFyIHF1ZXJ5ID0gbmV3IGdvb2dsZS52aXN1YWxpemF0aW9uLlF1ZXJ5KHVybFByZWZpeCtodWNJZCt1cmxQb3N0aXgpO1xuICBxdWVyeS5zZXRUaW1lb3V0KDYwKjUpOyAvLyA1IG1pbiB0aW1lb3V0XG4gIHF1ZXJ5LnNlbmQoZnVuY3Rpb24ocmVzcG9uc2Upe1xuICAgIGlmIChyZXNwb25zZS5pc0Vycm9yKCkgKSByZXR1cm4gYWxlcnQoJ0Vycm9yIHJldHJpZXZpbmcgSFVDIDEyIGRhdGEgZm9yIGlkIFwiJytodWNJZCsnXCInKTtcblxuICAgIHZhciBkYXRhID0gcmVzcG9uc2UuZ2V0RGF0YVRhYmxlKCk7XG5cbiAgICBpZiggZGF0YS5nZXROdW1iZXJPZlJvd3MoKSA9PSAwICkge1xuICAgICAgZGVidWdnZXI7XG4gICAgICByZXR1cm4gYWxlcnQoJ0Vycm9yOiBpbnZhbGlkIEhVQyAxMiBpZCBcIicraHVjSWQrXCInXCIpO1xuICAgIH1cblxuICAgIHZhciBnZW9tZXRyeSA9IEpTT04ucGFyc2UoZGF0YS5nZXRWYWx1ZSgwLCAwKSk7XG4gICAgdmFyIGdlb2pzb25GZWF0dXJlID0ge1xuICAgICAgXCJ0eXBlXCI6IFwiRmVhdHVyZVwiLFxuICAgICAgXCJwcm9wZXJ0aWVzXCI6IHtcbiAgICAgICAgICBcImlkXCI6IGh1Y0lkLFxuICAgICAgfSxcbiAgICAgIFwiZ2VvbWV0cnlcIjogZ2VvbWV0cnlcbiAgICB9O1xuICAgIGh1Y0NhY2hlW2h1Y0lkXSA9IGdlb2pzb25GZWF0dXJlO1xuXG4gICAgcmVuZGVySHVjKGh1Y0lkKTtcbiAgfSk7XG59XG5cbmZ1bmN0aW9uIHJlbmRlckh1YyhpZCkge1xuICBpZiggIXNob3dpbmcgKSByZXR1cm47XG5cbiAgdmFyIHBvaW50cyA9IHBvaW50c0J5SHVjW2lkXTtcblxuICAvLyBjYWxjdWxhdGUgcGVyY2VudCBkZW1hbmRcbiAgdmFyIHBlcmNlbnREZW1hbmRzID0gW10sIGZlYXR1cmU7XG4gIGZvciggdmFyIGkgPSAwOyBpIDwgcG9pbnRzLmxlbmd0aDsgaSsrICkge1xuICAgIGZlYXR1cmUgPSBwb2ludHNbaV07XG5cbiAgICBpZiggZmVhdHVyZS5wcm9wZXJ0aWVzLmFsbG9jYXRpb25zICYmIGZlYXR1cmUucHJvcGVydGllcy5hbGxvY2F0aW9ucy5sZW5ndGggPiAwICkge1xuICAgICAgdmFyIGRlbWFuZCA9IGZlYXR1cmUucHJvcGVydGllcy5hbGxvY2F0aW9uc1swXS5kZW1hbmQ7XG4gICAgICB2YXIgYWxsb2NhdGlvbiA9IGZlYXR1cmUucHJvcGVydGllcy5hbGxvY2F0aW9uc1swXS5hbGxvY2F0aW9uO1xuXG4gICAgICBpZiggZGVtYW5kICE9IDAgKSB7XG4gICAgICAgIHBlcmNlbnREZW1hbmRzLnB1c2goYWxsb2NhdGlvbiAvIGRlbWFuZCk7XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgLy8gY2FsYyBhdmVyYWdlXG4gIHZhciBhdmdQcmVjZW50RGVtYW5kID0gLTE7XG4gIHZhciB0bXAgPSAwO1xuICBmb3IoIHZhciBpID0gMDsgaSA8IHBlcmNlbnREZW1hbmRzLmxlbmd0aDsgaSsrICkge1xuICAgIHRtcCArPSBwZXJjZW50RGVtYW5kc1tpXTtcbiAgfVxuICBpZiggcGVyY2VudERlbWFuZHMubGVuZ3RoID4gMCApIGF2Z1ByZWNlbnREZW1hbmQgPSB0bXAgLyBwZXJjZW50RGVtYW5kcy5sZW5ndGg7XG5cbiAgdmFyIGxheWVyID0gTC5nZW9Kc29uKFxuICAgIGh1Y0NhY2hlW2lkXSxcbiAgICB7XG4gICAgICBzdHlsZTogZnVuY3Rpb24oZmVhdHVyZSkge1xuICAgICAgICByZXR1cm4gbWFya2VyQ29uZmlnLnBlcmNlbnREZW1hbmRIdWMoYXZnUHJlY2VudERlbWFuZCk7XG4gICAgICB9XG4gICAgfVxuICApLmFkZFRvKG1hcCk7XG5cbiAgbGF5ZXJzLnB1c2gobGF5ZXIpO1xufVxuXG5tb2R1bGUuZXhwb3J0cyA9IHtcbiAgaW5pdCA6IGluaXQsXG4gIHJlbmRlciA6IHJlbmRlclxufTtcbiIsInJlcXVpcmUoJy4vbGVhZmxldCcpOyAvLyBpbXBvcnQgY3VzdG9tIG1hcmtlcnMgdG8gbGVhZmxldCBuYW1lc3BhY2UgKGdsb2JhbClcbnZhciBtYXAgPSByZXF1aXJlKCcuL21hcCcpO1xudmFyIGh1YyA9IHJlcXVpcmUoJy4vaHVjJyk7XG52YXIgZmlsZSA9IHJlcXVpcmUoJy4vZmlsZScpO1xudmFyIGRpcmVjdG9yeSA9IHJlcXVpcmUoJy4vbGlicmFyeScpO1xudmFyIGRhdGFzdG9yZSA9IHJlcXVpcmUoJy4vZGF0YXN0b3JlJyk7XG5cblxudmFyIG1hcCwgZ2VvSnNvbkxheWVyO1xudmFyIHdtc0xheWVycyA9IFtdO1xudmFyIGFsbERhdGEgPSBbXTtcblxuLy8gc2hvdWxkIGJlIGZpbGxlZCBvciBlbXB0eTtcbnZhciByZW5kZXJEZW1hbmQgPSAnZW1wdHknO1xudmFyIGN1cnJlbnRQb2ludHMgPSBudWxsO1xudmFyIGxhc3RSZXNwUG9pbnRzID0gbnVsbDtcblxuJChkb2N1bWVudCkub24oJ3JlYWR5JywgZnVuY3Rpb24oKXtcbiAgcmVzaXplKCk7XG4gIGluaXQoKTtcbn0pO1xuXG4kKHdpbmRvdylcbiAgLm9uKCdyZXNpemUnLCByZXNpemUpO1xuXG5mdW5jdGlvbiBpbml0KCkge1xuICBtYXAuaW5pdCh7XG4gICAgZGF0YXN0b3JlIDogZGF0YXN0b3JlLFxuICAgIGh1YyA6IGh1Y1xuICB9KTtcblxuICBodWMuaW5pdCh7XG4gICAgZGF0YXN0b3JlIDogZGF0YXN0b3JlLFxuICAgIG1hcCA6IG1hcFxuICB9KTtcblxuICBmaWxlLmluaXQoe1xuICAgIGRhdGFzdG9yZSA6IGRhdGFzdG9yZSxcbiAgICBtYXAgOiBtYXBcbiAgfSk7XG59XG5cbmZ1bmN0aW9uIHJlc2l6ZSgpIHtcbiAgdmFyIGggPSB3aW5kb3cuaW5uZXJIZWlnaHQ7XG4gIHZhciB3ID0gd2luZG93LmlubmVyV2lkdGg7XG4gIGlmKCBoID09PSBudWxsICkgaCA9ICQod2luZG93KS5oZWlnaHQoKTtcbiAgaWYoIHcgPT09IG51bGwgKSB3ID0gJCh3aW5kb3cpLndpZHRoKCk7XG5cbiAgJCgnI21hcCcpLmhlaWdodChoKS53aWR0aCh3KTtcbiAgJCgnI2luZm8nKS5jc3MoJ21heC1oZWlnaHQnLCAoaC04NSkrJ3B4Jyk7XG59XG5cbm1vZHVsZS5leHBvcnRzID0ge1xuICBtYXAgOiBtYXAsXG4gIGh1YyA6IGh1YyxcbiAgZmlsZSA6IGZpbGUsXG4gIGRpcmVjdG9yeSA6IGRpcmVjdG9yeSxcbiAgZHMgOiBkYXRhc3RvcmVcbn07XG4iLCJ2YXIgSWNvblJlbmRlcmVyID0gcmVxdWlyZSgnLi4vbWFya2Vycy9pY29uUmVuZGVyZXInKTtcblxuTC5JY29uLkNhbnZhcyA9IEwuSWNvbi5leHRlbmQoe1xuICAgIG9wdGlvbnM6IHtcbiAgICAgICAgaWNvblNpemU6IG5ldyBMLlBvaW50KDIwLCAyMCksIC8vIEhhdmUgdG8gYmUgc3VwcGxpZWRcbiAgICAgICAgY2xhc3NOYW1lOiAnbGVhZmxldC1jYW52YXMtaWNvbidcbiAgICB9LFxuXG4gICAgY3JlYXRlSWNvbjogZnVuY3Rpb24gKCkge1xuICAgICAgICB2YXIgZSA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2NhbnZhcycpO1xuICAgICAgICB0aGlzLl9zZXRJY29uU3R5bGVzKGUsICdpY29uJyk7XG5cbiAgICAgICAgZS53aWR0aCA9IHRoaXMub3B0aW9ucy53aWR0aDtcbiAgICAgICAgZS5oZWlnaHQgPSB0aGlzLm9wdGlvbnMuaGVpZ2h0O1xuXG4gICAgICAgIGUuc3R5bGUubWFyZ2luVG9wID0gKC0xKnRoaXMub3B0aW9ucy53aWR0aC8yKSsncHgnO1xuICAgICAgICBlLnN0eWxlLm1hcmdpbkxlZnQgPSAoLTEqdGhpcy5vcHRpb25zLmhlaWdodC8yKSsncHgnO1xuXG4gICAgICAgIGUuc3R5bGUud2lkdGggPSB0aGlzLm9wdGlvbnMud2lkdGgrJ3B4JztcbiAgICAgICAgZS5zdHlsZS5oZWlnaHQgPXRoaXMub3B0aW9ucy5oZWlnaHQrJ3B4JztcblxuICAgICAgICB0aGlzLmRyYXcoZS5nZXRDb250ZXh0KCcyZCcpKTtcblxuICAgICAgICByZXR1cm4gZTtcbiAgICB9LFxuXG4gICAgY3JlYXRlU2hhZG93OiBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHJldHVybiBudWxsO1xuICAgIH0sXG5cblxuICAgIGRyYXc6IGZ1bmN0aW9uKGN0eCkge1xuICAgICAgSWNvblJlbmRlcmVyKGN0eCwgdGhpcy5vcHRpb25zKTtcbiAgICB9XG59KTtcbiIsIkwuZHdyYXRNYXJrZXIgPSBmdW5jdGlvbiAobGF0bG5nLCBvcHRpb25zKSB7XG4gIHZhciBtYXJrZXIgPSBuZXcgTC5NYXJrZXIobGF0bG5nLCB7XG4gICAgICBpY29uOiBuZXcgTC5JY29uLkNhbnZhcyhvcHRpb25zKSxcbiAgICAgIGljb25TaXplOiBuZXcgTC5Qb2ludChvcHRpb25zLndpZHRoLCBvcHRpb25zLmhlaWdodCksXG4gIH0pO1xuXG4gIG1hcmtlci5zZXRTdHlsZSA9IGZ1bmN0aW9uKG9wdGlvbnMpIHtcbiAgICB2YXIgbyA9IHRoaXMub3B0aW9ucy5pY29uLm9wdGlvbnM7XG5cbiAgICAkLmV4dGVuZCh0cnVlLCBvLCBvcHRpb25zKTtcbiAgICBpZiggIXRoaXMuX2ljb24gKSByZXR1cm47XG5cbiAgICB2YXIgY3R4ID0gdGhpcy5faWNvbi5nZXRDb250ZXh0KCcyZCcpO1xuICAgIGN0eC5jbGVhclJlY3QoMCwgMCwgby53aWR0aCwgby5oZWlnaHQpO1xuXG4gICAgSWNvblJlbmRlcmVyKGN0eCwgbyk7XG4gIH1cblxuICByZXR1cm4gbWFya2VyO1xufTtcbiIsInJlcXVpcmUoJy4vY2FudmFzJyk7XG5yZXF1aXJlKCcuL2R3cmF0Jyk7XG4iLCJ2YXIgRHJvdWdodEljb24gPSByZXF1aXJlKCcuLi9tYXJrZXJzL2Ryb3VnaHRJY29uJyk7XG52YXIgbWFya2VyQ29uZmlnID0gcmVxdWlyZSgnLi4vbWFya2Vycy9jb25maWcnKTtcbnZhciBtYXJrZXJzID0gbWFya2VyQ29uZmlnLmRlZmF1bHRzO1xudmFyIG1hcDtcblxubW9kdWxlLmV4cG9ydHMuaW5pdCA9IGZ1bmN0aW9uKG0pIHtcbiAgbWFwID0gbTtcblxuICB2YXIgZGVtYW5kU3RlcHMgPSBbMCwgMSwgNTAsIDEwMCwgMjUwXTtcblxuICB2YXIgb3B0aW9ucyA9ICQuZXh0ZW5kKHRydWUsIHt9LCBtYXJrZXJzLnJpcGFyaWFuLnVuYWxsb2NhdGVkKTtcbiAgb3B0aW9ucy5zaWRlcyA9IDA7XG4gIHZhciBpY29uID0gbmV3IERyb3VnaHRJY29uKG9wdGlvbnMpO1xuICAkKCcjbGVnZW5kLXJpcGFyaWFuJykuYXBwZW5kKCQoaWNvbi5lbGUpKTtcblxuXG4gIG9wdGlvbnMgPSAkLmV4dGVuZCh0cnVlLCB7fSwgbWFya2Vycy5hcHBsaWNhdGlvbi51bmFsbG9jYXRlZCk7XG4gIG9wdGlvbnMuc2lkZXMgPSAzO1xuICBvcHRpb25zLnJvdGF0ZSA9IDkwO1xuICBpY29uID0gbmV3IERyb3VnaHRJY29uKG9wdGlvbnMpO1xuICAkKCcjbGVnZW5kLXByZS1hcHByb3ByaWF0aXZlJykuYXBwZW5kKCQoaWNvbi5lbGUpKTtcblxuICBpY29uID0gbmV3IERyb3VnaHRJY29uKG1hcmtlcnMuYXBwbGljYXRpb24udW5hbGxvY2F0ZWQpO1xuICAkKCcjbGVnZW5kLXBvc3QtYXBwcm9wcmlhdGl2ZScpLmFwcGVuZCgkKGljb24uZWxlKSk7XG5cbiAgdmFyIHRhYmxlID0gJzx0YWJsZSBzdHlsZT1cInRleHQtYWxpZ246Y2VudGVyXCI+PHRyIHN0eWxlPVwidmVydGljYWwtYWxpZ246IGJvdHRvbVwiPic7XG4gIHZhciBpY29ucyA9IFtdO1xuICBmb3IoIHZhciBpID0gMDsgaSA8IGRlbWFuZFN0ZXBzLmxlbmd0aDsgaSsrICkge1xuICAgIHRhYmxlICs9ICc8dGQgc3R5bGU9XCJwYWRkaW5nOjRweFwiPjxkaXYgaWQ9XCJsZWdlbmQtZGVtYW5kLScraSsnXCI+PC9kaXY+PGRpdj4nK1xuICAgICAgICAgICAgICAoZGVtYW5kU3RlcHNbaV0gPT0gMSA/ICc8JyA6ICcnKSArXG4gICAgICAgICAgICAgIChkZW1hbmRTdGVwc1tpXSA9PSAyNTAgPyAnPicgOiAnJykgK1xuICAgICAgICAgICAgICBkZW1hbmRTdGVwc1tpXSsnPC9kaXY+PC90ZD4nO1xuXG5cbiAgICBpZiggZGVtYW5kU3RlcHNbaV0gPT09IDAgKSB7XG4gICAgICBvcHRpb25zID0gJC5leHRlbmQodHJ1ZSwge30sIG1hcmtlcnMuYXBwbGljYXRpb24udW5hbGxvY2F0ZWQpO1xuICAgICAgb3B0aW9ucyA9ICQuZXh0ZW5kKHRydWUsIG9wdGlvbnMsIG1hcmtlcnMubm9EZW1hbmQpO1xuICAgIH0gZWxzZSB7XG4gICAgICBvcHRpb25zID0gJC5leHRlbmQodHJ1ZSwge30sIG1hcmtlcnMuYXBwbGljYXRpb24udW5hbGxvY2F0ZWQpO1xuXG4gICAgICB2YXIgc2l6ZSA9IE1hdGguc3FydChkZW1hbmRTdGVwc1tpXSkgKiAzO1xuICAgICAgaWYoIHNpemUgPiA1MCApIHNpemUgPSA1MDtcbiAgICAgIGlmKCBzaXplIDwgNyApIHNpemUgPSA3O1xuXG4gICAgICBvcHRpb25zLmhlaWdodCA9IChzaXplKjIpKzI7XG4gICAgICBvcHRpb25zLndpZHRoID0gKHNpemUqMikrMjtcbiAgICB9XG5cbiAgICBpY29ucy5wdXNoKG5ldyBEcm91Z2h0SWNvbihvcHRpb25zKSk7XG4gIH1cbiAgJCgnI2xlZ2VuZC1kZW1hbmQnKS5odG1sKHRhYmxlKyc8L3RyPjwvdGFibGU+Jyk7XG5cbiAgZm9yKCBpID0gMDsgaSA8IGljb25zLmxlbmd0aDsgaSsrICkge1xuICAgICQoJyNsZWdlbmQtZGVtYW5kLScraSkuYXBwZW5kKCQoaWNvbnNbaV0uZWxlKSk7XG4gIH1cblxuICB0aGlzLnJlZHJhd1BEZW1hbmRMZWdlbmQoKTtcblxuICAvLyBpbml0IHRvZ2dsZSBidXR0b25cblxuICAkKCcjbGVnZW5kVG9nZ2xlJykub24oJ2NsaWNrJywgZnVuY3Rpb24oKXtcbiAgICBpZiggdGhpcy5oYXNBdHRyaWJ1dGUoJ3Nob3dpbmcnKSApIHtcbiAgICAgIHRoaXMucmVtb3ZlQXR0cmlidXRlKCdzaG93aW5nJyk7XG4gICAgICAkKCcjbGVnZW5kJykuaGlkZSgnc2xvdycpO1xuICAgICAgdGhpcy5pbm5lckhUTUwgPSAnPGkgY2xhc3M9XCJmYSBmYS1hcnJvdy1yaWdodFwiPjwvaT4nO1xuXG4gICAgfSBlbHNlIHtcbiAgICAgIHRoaXMuc2V0QXR0cmlidXRlKCdzaG93aW5nJywgJycpO1xuICAgICAgJCgnI2xlZ2VuZCcpLnNob3coJ3Nsb3cnKTtcbiAgICAgIHRoaXMuaW5uZXJIVE1MID0gJzxpIGNsYXNzPVwiZmEgZmEtYXJyb3ctZG93blwiPjwvaT4nO1xuICAgIH1cbiAgfSk7XG5cbiAgJCgnI3JlbmRlclR5cGVGaWxsZWQnKS5vbignY2xpY2snLCBvblJlbmRlclR5cGVDaGFuZ2UpO1xuICAkKCcjcmVuZGVyVHlwZUVtcHR5Jykub24oJ2NsaWNrJywgb25SZW5kZXJUeXBlQ2hhbmdlKTtcblxuICAkKCcjc2hvd05vRGVtYW5kJykub24oJ2NsaWNrJywgZnVuY3Rpb24oKXtcbiAgICBpZiggZ2VvSnNvbkxheWVyICkge1xuICAgICAgbWFwLnJlbW92ZUxheWVyKGdlb0pzb25MYXllcik7XG4gICAgICBnZW9Kc29uTGF5ZXIgPSBudWxsO1xuICAgICAgYWxsRGF0YSA9IFtdO1xuICAgIH1cblxuICAgIGFkZEdlb0pzb24obGFzdFJlc3BQb2ludHMpO1xuICB9KTtcbn07XG5cbm1vZHVsZS5leHBvcnRzLnJlZHJhd1BEZW1hbmRMZWdlbmQgPSBmdW5jdGlvbigpIHtcbiAgdmFyIHBlcmNlbnRTdGVwcyA9IFswLCAyNSwgNTAsIDc1LCAxMDBdLCBpO1xuXG4gIHZhciB0YWJsZSA9ICc8dGFibGUgc3R5bGU9XCJ0ZXh0LWFsaWduOmNlbnRlclwiPjx0ciBzdHlsZT1cInZlcnRpY2FsLWFsaWduOiBib3R0b21cIj4nO1xuICB2YXIgaWNvbnMgPSBbXTtcblx0Zm9yKCBpID0gMDsgaSA8IHBlcmNlbnRTdGVwcy5sZW5ndGg7IGkrKyApIHtcblx0XHR0YWJsZSArPSAnPHRkIHN0eWxlPVwicGFkZGluZzo4cHhcIj48ZGl2IGlkPVwibGVnZW5kLXByZWNlbnQtb2YtZGVtYW5kLScraSsnXCI+PC9kaXY+PGRpdj4nK1xuXHRcdFx0XHRcdHBlcmNlbnRTdGVwc1tpXSsnJTwvZGl2PjwvdGQ+JztcblxuXHRcdHZhciBvcHRpb25zID0gJC5leHRlbmQodHJ1ZSwge30sIG1hcmtlcnMuYXBwbGljYXRpb24udW5hbGxvY2F0ZWQpO1xuXG4gICAgbWFya2VyQ29uZmlnLnBlcmNlbnREZW1hbmQob3B0aW9ucywgcGVyY2VudFN0ZXBzW2ldIC8gMTAwKTtcblxuXHRcdGljb25zLnB1c2gobmV3IERyb3VnaHRJY29uKG9wdGlvbnMpKTtcblx0fVxuXHQkKCcjbGVnZW5kLXByZWNlbnQtb2YtZGVtYW5kJykuaHRtbCh0YWJsZSsnPC90cj48L3RhYmxlPicpO1xuXG5cdGZvciggaSA9IDA7IGkgPCBpY29ucy5sZW5ndGg7IGkrKyApIHtcblx0XHQkKCcjbGVnZW5kLXByZWNlbnQtb2YtZGVtYW5kLScraSkuYXBwZW5kKCQoaWNvbnNbaV0uZWxlKSk7XG5cdH1cbn07XG5cbmZ1bmN0aW9uIG9uUmVuZGVyVHlwZUNoYW5nZSgpIHtcbiAgdmFyIGlzRmlsbGVkQ2hlY2tlZCA9ICQoJyNyZW5kZXJUeXBlRmlsbGVkJykuaXMoJzpjaGVja2VkJyk7XG4gIHZhciBuZXdWYWwgPSBpc0ZpbGxlZENoZWNrZWQgPyAnZmlsbGVkJyA6ICdlbXB0eSc7XG5cbiAgaWYoIHJlbmRlckRlbWFuZCA9PSBuZXdWYWwgKSByZXR1cm47XG4gIHJlbmRlckRlbWFuZCA9IG5ld1ZhbDtcblxuICAvLyByZW5kZXIgbGVnZW5kXG4gIHRoaXMucmVkcmF3UERlbWFuZExlZ2VuZCgpO1xuXG4gIGlmKCAhY3VycmVudFBvaW50cyApIHJldHVybjtcblxuICBpZiggZ2VvSnNvbkxheWVyICkge1xuICAgIG1hcC5yZW1vdmVMYXllcihnZW9Kc29uTGF5ZXIpO1xuICAgIGdlb0pzb25MYXllciA9IG51bGw7XG4gICAgYWxsRGF0YSA9IFtdO1xuICB9XG4gIG1hcC5hZGRHZW9Kc29uKGN1cnJlbnRQb2ludHMpO1xufTtcblxuZnVuY3Rpb24gc3RhbXAoZGF0YSkge1xuICB2YXIgdGVtcGxhdGUgPSBtYXJrZXJUZW1wbGF0ZTtcbiAgZm9yKCB2YXIga2V5IGluIGRhdGEgKSB0ZW1wbGF0ZSA9IHRlbXBsYXRlLnJlcGxhY2UoJ3t7JytrZXkrJ319JywgZGF0YVtrZXldKTtcbiAgcmV0dXJuIHRlbXBsYXRlO1xufVxuIiwidmFyIGZpbGVzID0gW107XG5cbnZhciByb290ID0gJ2h0dHBzOi8vZG9jcy5nb29nbGUuY29tL3NwcmVhZHNoZWV0cy9kLzFBQ2k3UDBwT3ktSlJqdHc2SHJpYlFwaGhFT1otMC1Da1FfbXFueUNmSmNJL2d2aXovdHEnO1xuXG5mdW5jdGlvbiBpbml0KHJlc3ApIHtcbiAgdmFyIHF1ZXJ5ID0gbmV3IGdvb2dsZS52aXN1YWxpemF0aW9uLlF1ZXJ5KHJvb3QpO1xuICBxdWVyeS5zZW5kKG9uSW5pdExvYWQpO1xufVxuXG5mdW5jdGlvbiBvbkluaXRMb2FkKHJlc3ApIHtcbiAgaWYgKHJlc3AuaXNFcnJvcigpKSB7XG4gICAgYWxlcnQoJ0Vycm9yIGluIGxvYWRpbmcgcHVibGljIGRhdGE6ICcgKyByZXNwb25zZS5nZXRNZXNzYWdlKCkgKyAnICcgKyByZXNwb25zZS5nZXREZXRhaWxlZE1lc3NhZ2UoKSk7XG4gICAgcmV0dXJuO1xuICB9XG5cbiAgdmFyIGRhdGEgPSByZXNwLmdldERhdGFUYWJsZSgpO1xuICB2YXIgcm93TGVuID0gZGF0YS5nZXROdW1iZXJPZlJvd3MoKTtcbiAgdmFyIGNvbExlbiA9IGRhdGEuZ2V0TnVtYmVyT2ZDb2x1bW5zKCk7XG5cblxuICBmb3IoIHZhciBpID0gMDsgaSA8IHJvd0xlbjsgaSsrICkge1xuICAgIHZhciBmaWxlID0ge307XG4gICAgZm9yKCB2YXIgaiA9IDA7IGogPCBjb2xMZW47IGorKyApIHtcbiAgICAgIGZpbGVbZGF0YS5nZXRDb2x1bW5JZChqKV0gPSBkYXRhLmdldFZhbHVlKGksIGopO1xuICAgIH1cbiAgICBmaWxlcy5wdXNoKGZpbGUpO1xuICB9XG5cbiAgY29uc29sZS5sb2coZmlsZXMpO1xufVxuXG5tb2R1bGUuZXhwb3J0cyA9IHtcbiAgaW5pdCA6IGluaXRcbn07XG4iLCJ2YXIgbWFya2VyQ29uZmlnID0gcmVxdWlyZSgnLi4vbWFya2Vycy9jb25maWcnKTtcbnZhciBtYXJrZXJzID0gbWFya2VyQ29uZmlnLmRlZmF1bHRzO1xuXG52YXIgZ2VvSnNvbkxheWVyO1xudmFyIG1hcCwgaHVjLCBkYXRhc3RvcmU7XG5cbm1vZHVsZS5leHBvcnRzLmluaXQgPSBmdW5jdGlvbihjb25maWcpIHtcbiAgbWFwID0gY29uZmlnLm1hcC5nZXRMZWFmbGV0KCk7XG4gIGRhdGFzdG9yZSA9IGNvbmZpZy5kYXRhc3RvcmU7XG4gIGh1YyA9IGNvbmZpZy5odWM7XG59O1xuXG5tb2R1bGUuZXhwb3J0cy5hZGQgPSBmdW5jdGlvbihwb2ludHMpIHtcbiAgdmFyIHNob3dOb0RlbWFuZCA9ICQoJyNzaG93Tm9EZW1hbmQnKS5pcygnOmNoZWNrZWQnKTtcbiAgZGF0YXN0b3JlLmNsZWFyRmVhdHVyZXMoKTtcblxuICBpZiggIXNob3dOb0RlbWFuZCApIHtcbiAgICB0bXAgPSBbXTtcbiAgICBmb3IoIHZhciBpID0gcG9pbnRzLmxlbmd0aC0xOyBpID49IDA7IGktLSApIHtcbiAgICAgIGlmKCBwb2ludHNbaV0ucHJvcGVydGllcy5hbGxvY2F0aW9ucyAmJiBwb2ludHNbaV0ucHJvcGVydGllcy5hbGxvY2F0aW9ucy5sZW5ndGggPiAwICkge1xuXG4gICAgICAgIHZhciBkZW1hbmQgPSBwb2ludHNbaV0ucHJvcGVydGllcy5hbGxvY2F0aW9uc1swXS5kZW1hbmQ7XG4gICAgICAgIGlmKCBkZW1hbmQgIT09IDAgKSB0bXAucHVzaChwb2ludHNbaV0pO1xuICAgICAgfVxuICAgIH1cbiAgICBwb2ludHMgPSB0bXA7XG4gIH1cblxuICBnZW9Kc29uTGF5ZXIgPSBMLmdlb0pzb24ocG9pbnRzLHtcbiAgICBwb2ludFRvTGF5ZXI6IGZ1bmN0aW9uIChmZWF0dXJlLCBsYXRsbmcpIHtcbiAgICAgIHZhciB0eXBlID0gZmVhdHVyZS5wcm9wZXJ0aWVzLnJpcGFyaWFuID8gJ3JpcGFyaWFuJyA6ICdhcHBsaWNhdGlvbic7XG4gICAgICB2YXIgYWxsb2NhdGlvbiA9ICd1bmFsbG9jYXRlZCc7XG5cbiAgICAgIGZvciggdmFyIGkgPSAwOyBpIDwgZmVhdHVyZS5wcm9wZXJ0aWVzLmFsbG9jYXRpb25zLmxlbmd0aDsgaSsrICkge1xuICAgICAgICBpZiggZmVhdHVyZS5wcm9wZXJ0aWVzLmFsbG9jYXRpb25zW2ldLmFsbG9jYXRpb24gPiAwICkgYWxsb2NhdGlvbiA9ICdhbGxvY2F0ZWQnO1xuICAgICAgfVxuXG5cbiAgICAgIHZhciBvcHRpb25zID0gJC5leHRlbmQodHJ1ZSwge30sIG1hcmtlcnNbdHlwZV1bYWxsb2NhdGlvbl0pO1xuXG4gICAgICBpZiggZmVhdHVyZS5wcm9wZXJ0aWVzLmFsbG9jYXRpb25zICYmIGZlYXR1cmUucHJvcGVydGllcy5hbGxvY2F0aW9ucy5sZW5ndGggPiAwICkge1xuXG4gICAgICAgIHZhciBkZW1hbmQgPSBmZWF0dXJlLnByb3BlcnRpZXMuYWxsb2NhdGlvbnNbMF0uZGVtYW5kO1xuICAgICAgICB2YXIgYWxsb2NhdGlvbiA9IGZlYXR1cmUucHJvcGVydGllcy5hbGxvY2F0aW9uc1swXS5hbGxvY2F0aW9uO1xuXG4gICAgICAgIGlmKCBkZW1hbmQgPT09IDAgKSB7XG5cbiAgICAgICAgICAkLmV4dGVuZCh0cnVlLCBvcHRpb25zLCBtYXJrZXJzLm5vRGVtYW5kKTtcbiAgICAgICAgICBmZWF0dXJlLnByb3BlcnRpZXMubm9EZW1hbmQgPSB0cnVlO1xuXG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgbWFya2VyQ29uZmlnLnBlcmNlbnREZW1hbmQob3B0aW9ucywgYWxsb2NhdGlvbiAvIGRlbWFuZCk7XG5cbiAgICAgICAgICB2YXIgc2l6ZSA9IE1hdGguc3FydChkZW1hbmQpICogMztcbiAgICAgICAgICBpZiggc2l6ZSA+IDUwICkgc2l6ZSA9IDUwO1xuICAgICAgICAgIGlmKCBzaXplIDwgNyApIHNpemUgPSA3O1xuXG4gICAgICAgICAgb3B0aW9ucy5oZWlnaHQgPSBzaXplKjI7XG4gICAgICAgICAgb3B0aW9ucy53aWR0aCA9IHNpemUqMjtcbiAgICAgICAgfVxuICAgICAgfVxuXG5cblxuICAgICAgdmFyIG1hcmtlcjtcbiAgICAgIHZhciBkO1xuICAgICAgdHJ5IHtcbiAgICAgICAgZCA9IGZlYXR1cmUucHJvcGVydGllcy5wcmlvcml0eV9kYXRlID8gcGFyc2VJbnQoZmVhdHVyZS5wcm9wZXJ0aWVzLnByaW9yaXR5X2RhdGUucmVwbGFjZSgvLS4qLywnJykpIDogMjAwMDtcbiAgICAgIH0gY2F0Y2goZSkge1xuICAgICAgICBkID0gMjAwMDtcbiAgICAgIH1cblxuICAgICAgaWYoIGZlYXR1cmUucHJvcGVydGllcy5yaXBhcmlhbiApIHtcbiAgICAgICAgb3B0aW9ucy5zaWRlcyA9IDA7XG4gICAgICAgIG1hcmtlciA9IEwuZHdyYXRNYXJrZXIobGF0bG5nLCBvcHRpb25zKTtcbiAgICAgIH0gZWxzZSBpZiAoIGQgPCAxOTE0ICkge1xuICAgICAgICBvcHRpb25zLnNpZGVzID0gMztcbiAgICAgICAgb3B0aW9ucy5yb3RhdGUgPSA5MDtcbiAgICAgICAgbWFya2VyID0gTC5kd3JhdE1hcmtlcihsYXRsbmcsIG9wdGlvbnMpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgbWFya2VyID0gTC5kd3JhdE1hcmtlcihsYXRsbmcsIG9wdGlvbnMpO1xuICAgICAgfVxuXG4gICAgICBkYXRhc3RvcmUuYWRkRmVhdHVyZSh7XG4gICAgICAgIGZlYXR1cmUgOiBmZWF0dXJlLFxuICAgICAgICBtYXJrZXIgIDogbWFya2VyXG4gICAgICB9KTtcbiAgICAgIHJldHVybiBtYXJrZXI7XG4gICAgfVxuICB9KS5hZGRUbyhtYXApO1xuXG4gIGdlb0pzb25MYXllci5vbignY2xpY2snLCBmdW5jdGlvbihlKSB7XG4gICAgJCgnLnNlbGVjdC10ZXh0JykucmVtb3ZlKCk7XG4gICAgJCgnI2luZm8nKS5zaG93KCk7XG4gICAgdmFyIHByb3BzID0gZS5sYXllci5mZWF0dXJlLnByb3BlcnRpZXM7XG5cbiAgICBzZWxlY3QoZS5sYXllcik7XG5cbiAgICB2YXIgbGwgPSBlLmxheWVyLmZlYXR1cmUuZ2VvbWV0cnkuY29vcmRpbmF0ZXM7XG5cbiAgICB2YXIgdCwgaHRtbCA9ICcnO1xuICAgIHZhciBhbGxEYXRhID0gZGF0YXN0b3JlLmdldEZlYXR1cmVzKCk7XG4gICAgZm9yKCB2YXIgaSA9IDA7IGkgPCBhbGxEYXRhLmxlbmd0aDsgaSsrICkge1xuICAgICAgdCA9IGFsbERhdGFbaV0uZmVhdHVyZS5nZW9tZXRyeS5jb29yZGluYXRlcztcbiAgICAgIGlmKCBsbFswXS50b0ZpeGVkKDQpID09IHRbMF0udG9GaXhlZCg0KSAmJiBsbFsxXS50b0ZpeGVkKDQpID09IHRbMV0udG9GaXhlZCg0KSApIHtcbiAgICAgICAgdmFyIHAgPSBhbGxEYXRhW2ldLmZlYXR1cmUucHJvcGVydGllcztcblxuICAgICAgICBodG1sICs9IHN0YW1wKHtcbiAgICAgICAgICBhcHBsaWNhdGlvbl9udW1iZXIgOiBwLmFwcGxpY2F0aW9uX251bWJlcixcbiAgICAgICAgICBkYXRlIDogcC5hbGxvY2F0aW9uc1swXS5kYXRlLFxuICAgICAgICAgIGFsbG9jYXRpb24gOiBwLmFsbG9jYXRpb25zWzBdLmFsbG9jYXRpb24sXG4gICAgICAgICAgZGVtYW5kIDogcC5hbGxvY2F0aW9uc1swXS5kZW1hbmQsXG4gICAgICAgICAgcmF0aW8gOiBwLmFsbG9jYXRpb25zWzBdLnJhdGlvICE9PSBudWxsID8gKHAuYWxsb2NhdGlvbnNbMF0ucmF0aW8qMTAwKS50b0ZpeGVkKDIpIDogJzEwMCcsXG4gICAgICAgICAgd2F0ZXJfcmlnaHRfdHlwZSA6IHBbJ1JpZ2h0IFR5cGUnXSxcbiAgICAgICAgICBwcmlvcml0eV9kYXRlIDogcC5wcmlvcml0eV9kYXRlID8gcC5wcmlvcml0eV9kYXRlIDogJ1Vua25vd24nXG4gICAgICAgIH0pO1xuICAgICAgfVxuICAgIH1cblxuXG4gICAgJCgnI2luZm8tcmVzdWx0JykuaHRtbChodG1sKTtcbiAgICAkKCcjaW5mbycpLmFuaW1hdGUoe1xuICAgICAgc2Nyb2xsVG9wOiAkKCcuaW5mby1ib3gnKS5oZWlnaHQoKVxuICAgIH0sIDMwMCk7XG4gIH0pO1xuXG4gIGN1cnJlbnRQb2ludHMgPSBwb2ludHM7XG5cbiAgaHVjLnJlbmRlcihwb2ludHMpO1xufTtcblxubW9kdWxlLmV4cG9ydHMuY2xlYXJMYXllciA9IGZ1bmN0aW9uKCkge1xuICBpZiggZ2VvSnNvbkxheWVyICkgbWFwLnJlbW92ZUxheWVyKGdlb0pzb25MYXllcik7XG59O1xuIiwidmFyIG1hcDtcbnZhciBiYXNlTWFwcyA9IHt9O1xudmFyIG92ZXJsYXlNYXBzID0ge307XG5cbnZhciBnZW9qc29uID0gcmVxdWlyZSgnLi9nZW9qc29uJyk7XG52YXIgZ2VvanNvbkxheWVyID0ge307XG5cbnZhciBjdXJyZW50UG9pbnRzID0gbnVsbDtcbnZhciBjdXJyZW50R2VvanNvbiA9IG51bGw7XG5cbm1vZHVsZS5leHBvcnRzLmxlZ2VuZCA9IHJlcXVpcmUoJy4uL2xlZ2VuZCcpO1xubW9kdWxlLmV4cG9ydHMuZ2VvanNvbiA9IHJlcXVpcmUoJy4vZ2VvanNvbicpO1xuXG5cblxubW9kdWxlLmV4cG9ydHMuaW5pdCA9IGZ1bmN0aW9uKG9wdGlvbnMpIHtcbiAgbWFwID0gTC5tYXAoJ21hcCcse3RyYWNrUmVzaXplOnRydWV9KTtcblxuICAvLyBhZGQgYW4gT3BlblN0cmVldE1hcCB0aWxlIGxheWVyXG4gIEwudGlsZUxheWVyKCdodHRwOi8ve3N9LnRpbGUub3NtLm9yZy97en0ve3h9L3t5fS5wbmcnLCB7XG4gICAgICBhdHRyaWJ1dGlvbjogJyZjb3B5OyA8YSBocmVmPVwiaHR0cDovL29zbS5vcmcvY29weXJpZ2h0XCI+T3BlblN0cmVldE1hcDwvYT4gY29udHJpYnV0b3JzJ1xuICB9KS5hZGRUbyhtYXApO1xuXG4gIHZhciB3bXMxID0gTC50aWxlTGF5ZXIud21zKFwiaHR0cHM6Ly9tYXBzZW5naW5lLmdvb2dsZS5jb20vMTU1NDI2MDA3MzQyNzU1NDk0NDQtMTE4NTM2NjcyNzMxMzE1NTAzNDYtNC93bXMvP3ZlcnNpb249MS4zLjBcIiwge1xuICAgICAgbGF5ZXJzOiAnMTU1NDI2MDA3MzQyNzU1NDk0NDQtMDgxMTI5NzQ2OTA5OTExNjQ1ODctNCcsXG4gICAgICBmb3JtYXQ6ICdpbWFnZS9wbmcnLFxuICAgICAgdHJhbnNwYXJlbnQ6IHRydWUsXG4gICAgICBhdHRyaWJ1dGlvbjogXCJcIixcbiAgICAgIGJvdW5kcyA6IEwubGF0TG5nQm91bmRzKFxuICAgICAgICBMLmxhdExuZyg0Mi4wMDk0MzE5ODgwNDA1OCwgLTExNC4xMzA3NTk3MjEzNDA3KSxcbiAgICAgICAgTC5sYXRMbmcoMzIuNTM0MjYzNDUzNjc0OTMsIC0xMjQuNDA5NzExNzE2NzgyOTgpXG4gICAgICApXG4gIH0pLmFkZFRvKG1hcCk7XG5cbiAgdmFyIHdtczIgPSBMLnRpbGVMYXllci53bXMoXCJodHRwczovL21hcHNlbmdpbmUuZ29vZ2xlLmNvbS8xNTU0MjYwMDczNDI3NTU0OTQ0NC0xMTg1MzY2NzI3MzEzMTU1MDM0Ni00L3dtcy8/dmVyc2lvbj0xLjMuMFwiLCB7XG4gICAgICBsYXllcnM6ICcxNTU0MjYwMDczNDI3NTU0OTQ0NC0xNjE0MzE1ODY4OTYwMzM2MTA5My00JyxcbiAgICAgIGZvcm1hdDogJ2ltYWdlL3BuZycsXG4gICAgICB0cmFuc3BhcmVudDogdHJ1ZSxcbiAgICAgIGF0dHJpYnV0aW9uOiBcIlwiLFxuICAgICAgYm91bmRzIDogTC5sYXRMbmdCb3VuZHMoXG4gICAgICAgIEwubGF0TG5nKDQyLjAwOTQzMTk4ODA0MDU4LCAtMTE0LjEzMDc1OTcyMTM0MDcpLFxuICAgICAgICBMLmxhdExuZygzMi41MzQyNjM0NTM2NzQ5MywgLTEyNC40MDk3MTE3MTY3ODI5OClcbiAgICAgIClcbiAgfSk7XG5cbiAgYmFzZU1hcHMgPSB7fTtcbiAgb3ZlcmxheU1hcHMgPSB7XG4gICAgJ1dhdGVyc2hlZHMnOiB3bXMxLFxuICAgICdIVUMgMTInOiB3bXMyXG4gIH07XG5cbiAgTC5jb250cm9sLmxheWVycyhiYXNlTWFwcywgb3ZlcmxheU1hcHMsIHtwb3NpdGlvbjogJ2JvdHRvbWxlZnQnfSkuYWRkVG8obWFwKTtcblxuICBvcHRpb25zLm1hcCA9IHRoaXM7XG4gIGdlb2pzb24uaW5pdChvcHRpb25zKTtcbn07XG5cbm1vZHVsZS5leHBvcnRzLmNsZWFyR2VvanNvbkxheWVyID0gZnVuY3Rpb24oKSB7XG4gIGdlb2pzb24uY2xlYXJMYXllcigpO1xufTtcbm1vZHVsZS5leHBvcnRzLmdldExlYWZsZXQgPSBmdW5jdGlvbigpIHtcbiAgcmV0dXJuIG1hcDtcbn07XG4iLCJ2YXIgbWFya2VycyA9IHtcbiAgcmlwYXJpYW4gOiB7XG4gICAgYWxsb2NhdGVkIDoge1xuICAgICAgZmlsbENvbG9yICAgOiBcIiMyNTI1QzlcIixcbiAgICAgIGNvbG9yICAgICAgIDogXCIjMzMzMzMzXCIsXG4gICAgICB3ZWlnaHQgICAgICA6IDEsXG4gICAgICBvcGFjaXR5ICAgICA6IDEsXG4gICAgICBmaWxsT3BhY2l0eSA6IDAuMyxcblx0XHRcdHNpZGVzIDogMyxcblx0XHRcdHJvdGF0ZSA6IDkwLFxuICAgICAgd2lkdGg6IDIwLFxuICAgICAgaGVpZ2h0OiAyMFxuICAgIH0sXG4gICAgdW5hbGxvY2F0ZWQgOiB7XG4gICAgICBmaWxsQ29sb3IgICA6IFwiI2ZmZmZmZlwiLFxuICAgICAgY29sb3IgICAgICAgOiBcIiMzMzMzMzNcIixcbiAgICAgIHdlaWdodCAgICAgIDogMSxcbiAgICAgIG9wYWNpdHkgICAgIDogMSxcbiAgICAgIGZpbGxPcGFjaXR5IDogMC4zLFxuXHRcdFx0c2lkZXMgOiAzLFxuXHRcdFx0cm90YXRlIDogOTAsXG4gICAgICB3aWR0aDogMjAsXG4gICAgICBoZWlnaHQ6IDIwXG4gICAgfVxuICB9LFxuICBhcHBsaWNhdGlvbiA6IHtcbiAgICBhbGxvY2F0ZWQgOiB7XG4gICAgICBmaWxsQ29sb3IgICA6IFwiIzI1MjVDOVwiLFxuICAgICAgY29sb3IgICAgICAgOiBcIiMzMzMzMzNcIixcbiAgICAgIHdlaWdodCAgICAgIDogMSxcbiAgICAgIG9wYWNpdHkgICAgIDogMSxcbiAgICAgIGZpbGxPcGFjaXR5IDogMC4zLFxuICAgICAgc2lkZXMgICAgICAgOiA0LFxuICAgICAgcm90YXRlICAgICAgOiA0NSxcbiAgICAgIHdpZHRoOiAyMCxcbiAgICAgIGhlaWdodDogMjBcbiAgICB9LFxuICAgIHVuYWxsb2NhdGVkIDoge1xuICAgICAgZmlsbENvbG9yICAgOiBcIiNmZmZmZmZcIixcbiAgICAgIGNvbG9yICAgICAgIDogXCIjMzMzMzMzXCIsXG4gICAgICB3ZWlnaHQgICAgICA6IDEsXG4gICAgICBvcGFjaXR5ICAgICA6IDEsXG4gICAgICBmaWxsT3BhY2l0eSA6IDAuMyxcbiAgICAgIHNpZGVzICAgICAgIDogNCxcbiAgICAgIHJvdGF0ZSAgICAgIDogNDUsXG4gICAgICB3aWR0aDogMjAsXG4gICAgICBoZWlnaHQ6IDIwXG4gICAgfVxuICB9LFxuICBub0RlbWFuZCA6IHtcbiAgICBub0ZpbGwgOiB0cnVlLFxuICAgIC8vc2lkZXMgOiAwLFxuICAgIGNvbG9yIDogXCIjMzMzMzMzXCIsXG4gICAgc3RyaWtldGhyb3VnaCA6IHRydWUsXG4gICAgcmFkaXVzIDogNSxcbiAgICBoZWlnaHQgOiAxMixcbiAgICB3aWR0aCA6IDEyXG4gIH1cbn07XG5tb2R1bGUuZXhwb3J0cy5kZWZhdWx0cyA9IG1hcmtlcnM7XG5cbm1vZHVsZS5leHBvcnRzLnBlcmNlbnREZW1hbmQgPSBmdW5jdGlvbihvcHRpb25zLCBwZXJjZW50LCBub0RlbWFuZCkge1xuICBpZiggbm9EZW1hbmQgKSB7XG4gICAgICQuZXh0ZW5kKHRydWUsIG9wdGlvbnMsIG1hcmtlcnMubm9EZW1hbmQpO1xuICAgICByZXR1cm47XG4gIH1cblxuICB2YXIgbztcblxuICBpZiggb3B0aW9ucy5yZW5kZXJEZW1hbmQgPT0gJ2ZpbGxlZCcgKSB7XG5cbiAgICBpZiggcGVyY2VudCA8PSAwICkge1xuICAgICAgb3B0aW9ucy5maWxsQ29sb3IgPSAnIzMzMyc7XG4gICAgICBvcHRpb25zLmZpbGxPcGFjaXR5ID0gMC4zO1xuICAgIH0gZWxzZSB7XG4gICAgICBvID0gcGVyY2VudDtcbiAgICAgIGlmKCBvID4gMSApIG8gPSAxO1xuICAgICAgb3B0aW9ucy5maWxsT3BhY2l0eSA9IG87XG4gICAgICBvcHRpb25zLmZpbGxDb2xvciA9ICcjMDAwMGZmJztcbiAgICB9XG5cbiAgfSBlbHNlIHtcblxuICAgIGlmKCBwZXJjZW50ID49IDEgKSB7XG4gICAgICBvcHRpb25zLmZpbGxDb2xvciA9ICcjMzMzJztcbiAgICAgIG9wdGlvbnMuZmlsbE9wYWNpdHkgPSAwLjM7XG4gICAgfSBlbHNlIHtcbiAgICAgIG8gPSAxIC0gcGVyY2VudDtcbiAgICAgIGlmKCBvID4gMSApIG8gPSAxO1xuICAgICAgaWYoIG8gPCAwICkgbyA9IDA7XG5cbiAgICAgIG9wdGlvbnMuZmlsbE9wYWNpdHkgPSBvO1xuICAgICAgb3B0aW9ucy5maWxsQ29sb3IgPSAnI2ZmMDAwMCc7XG4gICAgfVxuXG4gIH1cbiAgLy9vcHRpb25zLmZpbGxDb2xvciA9ICcjJytnZXRDb2xvcihhbGxvY2F0aW9uIC8gZGVtYW5kKTtcbn07XG5cbm1vZHVsZS5leHBvcnRzLnBlcmNlbnREZW1hbmRIdWMgPSBmdW5jdGlvbihvcHRpb25zKSB7XG4gIGlmKCBvcHRpb25zLnBlcmNlbnQgPT0gLTEgKSB7XG4gICAgIHJldHVybiB7XG4gICAgICAgZmlsbENvbG9yIDogJyNmZmZmZmYnLFxuICAgICAgIGZpbGxPcGFjaXR5IDogMC4yLFxuICAgICAgIHdlaWdodCA6IDEsXG4gICAgICAgY29sb3I6ICcjMzMzMzMzJ1xuICAgICB9O1xuICB9XG5cblxuICBpZiggb3B0aW9ucy5yZW5kZXJEZW1hbmQgPT0gJ2ZpbGxlZCcgKSB7XG5cbiAgICBpZiggb3B0aW9ucy5wZXJjZW50IDw9IDAgKSB7XG5cbiAgICAgIHJldHVybiB7XG4gICAgICAgIGZpbGxDb2xvciA6ICcjMzMzMzMzJyxcbiAgICAgICAgZmlsbE9wYWNpdHkgOiAwLjMsXG4gICAgICAgIHdlaWdodCA6IDIsXG4gICAgICAgIGNvbG9yOiAnIzMzMzMzMydcbiAgICAgIH07XG5cblxuICAgIH0gZWxzZSB7XG4gICAgICB2YXIgbyA9IG9wdGlvbnMucGVyY2VudDtcbiAgICAgIGlmKCBvID4gMC44ICkgbyA9IDAuODtcblxuICAgICAgcmV0dXJuIHtcbiAgICAgICAgZmlsbENvbG9yIDogJyMwMDAwZmYnLFxuICAgICAgICBmaWxsT3BhY2l0eSA6IG8sXG4gICAgICAgIHdlaWdodCA6IDIsXG4gICAgICAgIGNvbG9yOiAnIzMzMzMzMydcbiAgICAgIH07XG4gICAgfVxuXG4gIH0gZWxzZSB7XG5cbiAgICBpZiggb3B0aW9ucy5wZXJjZW50ID49IDEgKSB7XG5cbiAgICAgIHJldHVybiB7XG4gICAgICAgIGZpbGxDb2xvciA6ICcjMzMzMzMzJyxcbiAgICAgICAgZmlsbE9wYWNpdHkgOiAwLjMsXG4gICAgICAgIHdlaWdodCA6IDIsXG4gICAgICAgIGNvbG9yOiAnIzMzMzMzMydcbiAgICAgIH07XG5cbiAgICB9IGVsc2Uge1xuICAgICAgdmFyIG8gPSAxIC0gb3B0aW9ucy5wZXJjZW50O1xuICAgICAgaWYoIG8gPiAwLjggKSBvID0gMC44O1xuICAgICAgaWYoIG8gPCAwICkgbyA9IDA7XG5cbiAgICAgIHJldHVybiB7XG4gICAgICAgIGZpbGxDb2xvciA6ICcjZmYwMDAwJyxcbiAgICAgICAgZmlsbE9wYWNpdHkgOiBvLFxuICAgICAgICB3ZWlnaHQgOiAyLFxuICAgICAgICBjb2xvcjogJyMzMzMzMzMnXG4gICAgICB9O1xuXG4gICAgfVxuXG4gIH1cbiAgLy9vcHRpb25zLmZpbGxDb2xvciA9ICcjJytnZXRDb2xvcihhbGxvY2F0aW9uIC8gZGVtYW5kKTtcbn07XG4iLCJ2YXIgSWNvblJlbmRlcmVyID0gcmVxdWlyZSgnLi9pY29uUmVuZGVyZXInKTtcblxubW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbihjb25maWcpIHtcbiAgdGhpcy5jb25maWcgPSBjb25maWc7XG4gIHRoaXMuZWxlID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnY2FudmFzJyk7XG5cbiAgdGhpcy5yZWRyYXcgPSBmdW5jdGlvbigpIHtcbiAgICB2YXIgdyA9IGNvbmZpZy5oZWlnaHQgfHwgMzI7XG4gICAgdmFyIGggPSBjb25maWcud2lkdGggfHwgMzI7XG5cbiAgICB0aGlzLmVsZS5oZWlnaHQgPSBoO1xuICAgIHRoaXMuZWxlLndpZHRoID0gdztcblxuICAgIHZhciBjdHggPSB0aGlzLmVsZS5nZXRDb250ZXh0KFwiMmRcIik7XG4gICAgY3R4LmNsZWFyUmVjdCgwLCAwLCB3LCBoKTtcblxuICAgIEljb25SZW5kZXJlcihjdHgsIGNvbmZpZyk7XG4gIH07XG5cbiAgdGhpcy5yZWRyYXcoKTtcbn07XG4iLCJ2YXIgdXRpbCA9IHJlcXVpcmUoJy4vdXRpbHMnKTtcblxubW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbihjdHgsIGNvbmZpZykge1xuXG4gIHZhciBzaWRlcyA9IGNvbmZpZy5zaWRlcyAhPT0gbnVsbCA/IGNvbmZpZy5zaWRlcyA6IDY7XG4gIHZhciByb3RhdGUgPSBjb25maWcucm90YXRlID8gY29uZmlnLnJvdGF0ZSA6IDA7XG4gIHZhciB4ID0gY29uZmlnLndpZHRoIC8gMjtcbiAgdmFyIHkgPSBjb25maWcuaGVpZ2h0IC8gMjtcblxuICB2YXIgYSA9ICgoTWF0aC5QSSAqIDIpIC8gY29uZmlnLnNpZGVzKTtcbiAgdmFyIHIgPSByb3RhdGUgKiAoTWF0aC5QSSAvIDE4MCk7XG5cbiAgdmFyIHJhZGl1cyA9IChjb25maWcud2lkdGggLyAyKSAtIDE7XG5cbiAgdmFyIGZpbGxTdHlsZSA9IHV0aWwuaGV4VG9SZ2IoY29uZmlnLmZpbGxDb2xvcik7XG4gIGZpbGxTdHlsZS5wdXNoKGNvbmZpZy5maWxsT3BhY2l0eSk7XG4gIGN0eC5maWxsU3R5bGUgPSAncmdiYSgnK2ZpbGxTdHlsZS5qb2luKCcsJykrJyknO1xuXG4gIGN0eC5zdHJva2VTdHlsZSA9IGNvbmZpZy5jb2xvcjtcblxuICAvLyB0aGluayB5b3UgbmVlZCB0byBhZGp1c3QgYnkgeCwgeVxuICBjdHguYmVnaW5QYXRoKCk7XG5cbiAgLy8gZHJhdyBjaXJjbGVcbiAgaWYgKCBzaWRlcyA8IDMgKSB7XG5cbiAgICBjdHguYXJjKHgsIHksIHJhZGl1cywgMCwgMipNYXRoLlBJKTtcblxuICB9IGVsc2Uge1xuXG4gICAgdmFyIHR4LCB0eSwgaTtcbiAgICBmb3IgKGkgPSAwOyBpIDwgY29uZmlnLnNpZGVzOyBpKyspIHtcbiAgICAgIHR4ID0geCArIChyYWRpdXMgKiBNYXRoLmNvcyhhKmktcikpO1xuICAgICAgdHkgPSB5ICsgKHJhZGl1cyAqIE1hdGguc2luKGEqaS1yKSk7XG5cbiAgICAgIGlmKCBpID09PSAwICkgY3R4Lm1vdmVUbyh0eCwgdHkpO1xuICAgICAgZWxzZSBjdHgubGluZVRvKHR4LCB0eSk7XG4gICAgfVxuICAgIGN0eC5saW5lVG8oeCArIChyYWRpdXMgKiBNYXRoLmNvcygtMSAqIHIpKSwgeSArIChyYWRpdXMgKiBNYXRoLnNpbigtMSAqIHIpKSk7XG4gIH1cblxuICBpZiggIWNvbmZpZy5ub0ZpbGwgKSBjdHguZmlsbCgpO1xuICBjdHguc3Ryb2tlKCk7XG5cbiAgaWYoIGNvbmZpZy5zdHJpa2V0aHJvdWdoICkge1xuICAgIGN0eC5iZWdpblBhdGgoKTtcbiAgICBjdHgubW92ZVRvKDEsMSk7XG4gICAgY3R4LmxpbmVUbygoeCoyKSAtIDEsICh5KjIpIC0gMSk7XG4gICAgY3R4LnN0cm9rZSgpO1xuICB9XG59XG4iLCJtb2R1bGUuZXhwb3J0cy5oZXhUb1JnYiA9IGZ1bmN0aW9uKGhleCkge1xuICAgIHZhciByZXN1bHQgPSAvXiM/KFthLWZcXGRdezJ9KShbYS1mXFxkXXsyfSkoW2EtZlxcZF17Mn0pJC9pLmV4ZWMoaGV4KTtcbiAgICByZXR1cm4gcmVzdWx0ID8gW1xuICAgICAgICBwYXJzZUludChyZXN1bHRbMV0sIDE2KSxcbiAgICAgICAgcGFyc2VJbnQocmVzdWx0WzJdLCAxNiksXG4gICAgICAgIHBhcnNlSW50KHJlc3VsdFszXSwgMTYpXG4gICAgXSA6IFswLDAsMF07XG59O1xuXG5tb2R1bGUuZXhwb3J0cy5nZXRDb2xvciA9IGZ1bmN0aW9uKG51bSkge1xuICBpZiggbnVtID4gMSApIG51bSA9IDE7XG4gIGlmKCBudW0gPCAwICkgbnVtID0gMDtcblxuICB2YXIgc3ByZWFkID0gTWF0aC5mbG9vcig1MTAqbnVtKSAtIDI1NTtcblxuICBpZiggc3ByZWFkIDwgMCApIHJldHVybiBcImZmMDBcIit0b0hleCgyNTUrc3ByZWFkKTtcbiAgZWxzZSBpZiggc3ByZWFkID4gMCApIHJldHVybiB0b0hleCgyNTUtc3ByZWFkKStcIjAwZmZcIjtcbiAgZWxzZSByZXR1cm4gXCJmZmZmMDBcIjtcbn07XG5cbm1vZHVsZS5leHBvcnRzLnRvSGV4ID0gZnVuY3Rpb24obnVtKSB7XG4gIG51bSA9IG51bS50b1N0cmluZygxNik7XG4gIGlmKCBudW0ubGVuZ3RoID09IDEgKSBudW0gPSBcIjBcIitudW07XG4gIHJldHVybiBudW07XG59O1xuIl19
