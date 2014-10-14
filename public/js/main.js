var map, geoJsonLayer;

var wmsLayers = [];

$(window).on('ready', function(){
	resize();
	init();
}).on('resize', function(e){
	resize();
}).on('hashchange', onHashUpdate);

var allData = [];

var markerTemplate = 
	'<div class="spacer"></div>'+
	'<h3>Water Right/Claim #: {{application_number}}</h3>'+
	'<div style="margin:15px">'+
		'<b>For:</b> {{date}}<br />'+
		'<b>Allocation:</b> {{allocation}} [Ac-ft/day]<br />'+
		'<b>Demand:</b> {{demand}} [Ac-ft/day]'+
		'<br /><b>Percent: </b>{{ratio}}%<br />'+
		'<div class="well well-sm" style="margin-top:5px">'+
		'{{water_right_type}}<br />'+
		'<b>Priority Date:</b> {{priority_date}}'+
		'</div>'+
	'</div>'
	

var markers = {
	riparian : {
		allocated : {
	    	radius      : 9,
	    	fillColor   : "#2525C9",
	    	color       : "#333",
	    	weight      : 1,
	    	opacity     : 1,
	    	fillOpacity : .3,
		},
		unallocated : {
			radius      : 9,
	    	fillColor   : "#fff",
	    	color       : "#333",
	    	weight      : 1,
	    	opacity     : 1,
	    	fillOpacity : .3,
		}
	},
	application : {
		allocated : {
	    	radius      : 9,
	    	fillColor   : "#2525C9",
	    	color       : "#333",
	    	weight      : 1,
	    	opacity     : 1,
	    	fillOpacity : .3,
	    	sides       : 4,
			rotate      : 45
		},
		unallocated : {
			radius      : 9,
	    	fillColor   : "#fff",
	    	color       : "#333",
	    	weight      : 1,
	    	opacity     : 1,
	    	fillOpacity : .3,
	    	sides       : 4,
			rotate      : 45
		}
	}
}


function init() {
	map = L.map('map',{trackResize:true}).setView([38, -116], 6);

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

	var baseMaps = {};
	var overlayMaps = {
		'Watersheds': wms1,
		'HUC 12': wms2
	};
	L.control.layers(baseMaps, overlayMaps, {position: 'bottomleft'}).addTo(map);


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
		processFile(e);
	});
	$('#upload-btn').on('click', function(){
		$('#file-modal').modal('show');
	});

	$('body').on('dragover', function(e){
		e.preventDefault();
        e.stopPropagation();

		$('#upload-drop-message').show();
		$('#wrapper').css('opacity',.3);
	}).on('dragleave', function(e){
		e.preventDefault();
        e.stopPropagation();

		$('#upload-drop-message').hide();
		$('#wrapper').css('opacity',1);
	}).on('drop', function(e){
		$('#upload-drop-message').hide();
		$('#wrapper').css('opacity',1);

		processFile(e.originalEvent);
		$('#file-modal').modal('show');	
		
	});
}

function processFile(e) {
	e.stopPropagation();
	e.preventDefault();
	var files = e.dataTransfer ? e.dataTransfer.files : e.target.files; // FileList object.

	if( files.length > 0 ) {
		$('#file-locate').html('Loading file...');
		file.read(files[0], function(err, data){
			$('#file-locate').html('');
			file.matchCols(data, function(colMap){
				// now locate data and create
				file.createGeoJson(data, colMap, function(){

					$('#date-selection').hide();
					$('#file-selection').html(files[0].name+' <a class="btn btn-default" id="remove-file-btn"><i class="fa fa-times"></i></a>');
					$('#remove-file-btn').on('click',function(){
						if( geoJsonLayer ) map.removeLayer(geoJsonLayer);
						$('#date-selection').show();
						$('#file-selection').html('');
					});

					$('#file-input').val('');
					$('#file-modal').modal('hide');
				});
			});
		});
	}
}


function initVizSource() {
	getWatersheds();
}

function getWatersheds() {
	var query = new google.visualization.Query('http://watershed.ice.ucdavis.edu/vizsource/rest?view=watersheds&tq=SELECT * order by watershed');
  	query.send(function(response){
  		if (response.isError()) {
	      $('#response').html('<div class="alert alert-danger">Error in query: ' + response.getMessage() + ' ' 
	      		+ response.getDetailedMessage()+'</div>');
	      return;
	    }

	    var data = response.getDataTable();
	    var select = $('#watershed');
	    for( var i = 0; i < data.getNumberOfRows(); i++ ) {
    		if( data.getValue(i, 0) ) select.append('<option value="'+data.getValue(i, 0)+'" '+
    			(data.getValue(i, 0) == 'EEL RIVER' ? 'selected' : '') + ' >'+
    			data.getValue(i, 0)+'</option>');
    	};

    	$('#exec').removeClass('disabled').html('Execute');
    	initMapQuery();
  	});
}

function resize() {
	// why is this not working???
	//$('#map').height($(window).height())
	//		 .width($(window).width());

	var h = window.innerHeight;
	var w = window.innerWidth;
	if( h == null ) h = $(window).height();
	if( w == null ) w = $(window).width();

	$('#map').height(h).width(w);
	$('#info').css('max-height', (h-85)+'px');
}

function initMapQuery() {
	var date = new Date().toISOString().split('T')[0];
	
	var params = getHashParams()
	$('#date').val(params.date || date).on('change', function(){
		updateHash();
		//query();
	});
	$('#search').on('keypress', function(e){
		if( e.which == 13 ) query();
	});	

	var select = $('#watershed').on('change', function(e){
		updateHash();
		//query();
	});	
	if( params.river ) select.val(params.river);

	query();
}

function updateHash() {
	window.location.hash="date="+$('#date').val()+"&river="+$('#watershed').val();
}

function getHashParams() {
	var params = {}; parts = window.location.hash.replace(/#/g,'').split('&');
	for( var i = 0; i < parts.length; i++ ) {
		var p = parts[i].split('=');
		params[p[0]] = p[1];
	}
	return params;
}

function onHashUpdate() {
	params = getHashParams();
	if( params.date ) {
		$('#date').val(params.date);
	}
	if( params.river ) {
		$('#watershed').val(params.river);
	}
	query();
}

function query() {
	$('#loading').show();
	if( geoJsonLayer ) map.removeLayer(geoJsonLayer);
    geoJsonLayer = null;
    allData = [];

	//var query = new google.visualization.Query('http://watershed.ice.ucdavis.edu/vizsource/rest?view=demand(\'2014-03-01\')&tq=SELECT * limit 10');
  	var query = new google.visualization.Query('http://watershed.ice.ucdavis.edu/vizsource/rest?view=allocation(\''+
  		$('#date').val()+'\',\''+$('#watershed').val()+'\')&tq=SELECT *');
  	query.send(onDataLoad);
}


function onDataLoad(response) {
	if (response.isError()) {
      console.log('Error in query: ' + response.getMessage() + ' ' + response.getDetailedMessage());
      $('#loading').hide();
      return;
    }

    var data = response.getDataTable();

    // create table
    //var table = new google.visualization.Table(document.getElementById('table'));
    //table.draw(data, {});

    var columnMap = [];
    for( var i = 0; i < data.getNumberOfColumns(); i++ ) {
      columnMap.push(data.getColumnLabel(i));
    }

    var points = [];
    for( var i = 0; i < data.getNumberOfRows(); i++ ) {
    	for( var j = 0; j < data.getNumberOfColumns(); j++ ) {
    		
	        if( columnMap[j] == 'geojson' ) {
	        	var p = JSON.parse(data.getValue(i, j));
	        	
	        	if( p.properties.allocations[0].season ) {
	        		points.push(p);

			        var demand = p.properties.allocations[0].demand;
			        var allocation = p.properties.allocations[0].allocation;
			        if( demand > 0 ) {
			        	var ratio = allocation / demand;
			        	p.properties.allocations[0].ratio = ratio;
			        }
			    }
		    }
	    }
    };


    if( points.length == 0 ) {
    	$('#loading').hide();
    	return;
    }

    points.sort(function(a, b){
    	// TODO
    });

    addGeoJson(points);

	$('#loading').hide();
}

function addGeoJson(points) {
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

				if( demand == 0 ) {
					options.fillColor = '#333';
					options.radius = 6;
					options.fillOpacity = .3;
				} else {
					var size = Math.sqrt(demand) * 3;
					if( size > 50 ) size = 50;
					if( size < 7 ) size = 7;
					options.radius = size;

					var o = allocation / demand;
					if( o > 1 ) o = 1;
					options.fillOpacity = o;
					options.fillColor = '#0000ff';
					//options.fillColor = '#'+getColor(allocation / demand);
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
				marker = L.circleMarker(latlng, options);
			} else if ( d < 1914 ) {
				options.sides = 3;
				options.rotate = 90;
				marker = L.polyMarker(latlng, options);
			} else {
				marker = L.polyMarker(latlng, options);
			}

			allData.push({
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
		console.log(props);

		select(e.layer);

		/*for( var i = 0; i < allData.length; i++ ) {
			if( allData[i].feature.properties.application_number == props.application_number ) {
				select(allData[i].marker);
				break;
			}
		}*/

		//console.log("Matching...");
		//console.log(e.layer.feature.properties);
		//console.log("-----");

		var ll = e.layer.feature.geometry.coordinates;
		
		var t, html = '';
		for( var i = 0; i < allData.length; i++ ) {
			t = allData[i].feature.geometry.coordinates;
			if( ll[0].toFixed(4) == t[0].toFixed(4) && ll[1].toFixed(4) == t[1].toFixed(4) ) {
				var p = allData[i].feature.properties;

				html += stamp({
					application_number : p.application_number,
					date : p.allocations[0].date,
					allocation : p.allocations[0].allocation,
					demand : p.allocations[0].demand,
					ratio : p.allocations[0].ratio != null ? (p.allocations[0].ratio*100).toFixed(2) : '100',
					water_right_type : p.water_right_type,
					priority_date : p.priority_date ? p.priority_date : 'Unknown'
				});
			}
		}

		
		$('#info-result').html(html);
	});
}


function getColor(num) {
		if( num > 1 ) num = 1;
		if( num < 0 ) num = 0;
        var spread = Math.floor(510*num) - 255;

        if( spread < 0 ) return "ff00"+toHex(255+spread);
        else if( spread > 0 ) return toHex(255-spread)+"00ff";
        else return "ffff00";

}

function toHex(num) {
        num = num.toString(16);
        if( num.length == 1 ) num = "0"+num;
        return num;
}

var selected = null;
function select(marker) {
	if( selected != null ) {
		selected.setStyle({
			color : '#333',
			weight : 1
		});
		selected.redraw();
	}

	if( marker ) {
		marker.setStyle({
			color : '#ff0000',
			weight : 2
		})
		marker.redraw();
	}
	
	selected = marker;
}


function stamp(data) {
	var template = markerTemplate;
	for( var key in data ) template = template.replace('{{'+key+'}}', data[key]);
	return template;
}
