var map;


$(window).on('ready', function(){
	resize();
	init();
});

$(window).on('resize', function(e){
	resize();
});

var allData = [];

var markerTemplate = 
	'<div class="spacer"></div>'+
	'<h3>Water Right #: {{application_number}}</h3>'+
	'<div style="margin:15px">'+
		'<b>For:</b> {{date}}<br />'+
		'<b>Allocation:</b> {{allocation}} [Ac-ft/day]<br />'+
		'<b>Demand:</b> {{demand}} [Ac-ft/day]'+
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
	    	fillOpacity : .8,
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
	},
	application : {
		allocated : {
	    	radius      : 9,
	    	fillColor   : "#2525C9",
	    	color       : "#333",
	    	weight      : 1,
	    	opacity     : 1,
	    	fillOpacity : .8
		},
		unallocated : {
			radius      : 9,
	    	fillColor   : "#fff",
	    	color       : "#333",
	    	weight      : 1,
	    	opacity     : 1,
	    	fillOpacity : .3
		}
	}
}


function init() {
	map = L.map('map',{trackResize:true}).setView([38, -116], 6);

	// add an OpenStreetMap tile layer
	L.tileLayer('http://{s}.tile.osm.org/{z}/{x}/{y}.png', {
	    attribution: '&copy; <a href="http://osm.org/copyright">OpenStreetMap</a> contributors'
	}).addTo(map);

	L.tileLayer.wms("https://mapsengine.google.com/15542600734275549444-11853667273131550346-4/wms/?version=1.3.0", {
	    layers: '15542600734275549444-08112974690991164587-4',
	    format: 'image/png',
	    transparent: true,
	    attribution: "",
	    bounds : L.latLngBounds(
	    	L.latLng(42.00943198804058, -114.1307597213407),
	    	L.latLng(32.53426345367493, -124.40971171678298)
	    )
	}).addTo(map);


	$('#close-popup').on('click', function(){
		$('#info').removeClass('fadeInDown').addClass('slideOutRight');
		select(null);
		setTimeout(function(){
			$('#info').hide().addClass('fadeInDown').removeClass('slideOutRight');
		}, 800);
		
	});

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

function drawChart() {
	$('#date').val('2014-03-01').on('change', function(){
		alert('not implemented yet');
	});

	$('#search').on('keypress', function(e){
		if( e.which == 13 ) alert('not implemented yet');
	});
	//var query = new google.visualization.Query('http://watershed.ice.ucdavis.edu/vizsource/rest?view=demand(\'2014-03-01\')&tq=SELECT * limit 10');
  	var query = new google.visualization.Query('http://watershed.ice.ucdavis.edu/vizsource/rest?view=allocation(\'2014-03-01\')&tq=SELECT *');

  	query.send(onDataLoad);
}

function onDataLoad(response) {
	if (response.isError()) {
      console.log('Error in query: ' + response.getMessage() + ' ' + response.getDetailedMessage());
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
	        if( columnMap[j] == 'geojson' ) points.push(JSON.parse(data.getValue(i, j)));
	    }
    };

    var l = L.geoJson(points,{
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
					options.fillOpacity = .7;
				} else {
					var size = Math.sqrt(allocation) * 3;
					//if( size > 25 ) size = 25;
					if( size < 7 ) size = 7;
					options.radius = size;
				}	
			}



			var marker;
			if( feature.properties.riparian ) {
				marker = L.polyMarker(latlng, options);
			} else {
				marker = L.circleMarker(latlng, options);
			}

			allData.push({
				feature : feature,
				marker  : marker 
			});
			return marker;
	    }
	}).addTo(map);

	l.on('click', function(e) {
		$('.select-text').remove();
		$('#info').show();
		var props = e.layer.feature.properties;

		select(e.layer);

		/*for( var i = 0; i < allData.length; i++ ) {
			if( allData[i].feature.properties.application_number == props.application_number ) {
				select(allData[i].marker);
				break;
			}
		}*/

		var ll = e.layer.feature.geometry.coordinates;
		console.log(e.layer.feature);
		var t, html = '';
		for( var i = 0; i < allData.length; i++ ) {
			t = allData[i].feature.geometry.coordinates;
			if( ll[0].toFixed(4) == t[0].toFixed(4) && ll[1].toFixed(4) == t[1].toFixed(4) ) {
				html += stamp({
					application_number : allData[i].feature.properties.application_number,
					date : '2014-03-01',
					allocation : allData[i].feature.properties.allocations[0].allocation,
					demand : allData[i].feature.properties.allocations[0].demand,
					water_right_type : allData[i].feature.properties.water_right_type,
					priority_date : allData[i].feature.properties.priority_date
				});
			}
		}

		
		$('#info-result').html(html);
	});
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
