var map;
var location;
var drawControl;
var editsEnabled = false;
var currentlyEditing = false; // flag to indicate state of drawControl
var editingFeature = null; // the feature currently selected for editing
var uid = null;
var saveDialog;
var AucklandLatLng = [-36.8485, 174.7633];
var labelMarkerDic = {};
var accordionOptions = {active: false, collapsible: true,animate: false,heightStyle: "content"};
var iconSize = {
    small: 10,
    normal: 15,
    medium: 15,
    large: 20,
    xlarge: 30,
    xxlarge: 60,
    xxxlarge: 75,
    massive: 100,
};
var snapguides = [];
var locationCustomDescriptions = {};
var heatMapLayer;
//var location = require("location");
$(document).ready(function(){
    $.reject({  
        reject: {  
            safari: true, // Apple Safari  
            chrome: false, // Google Chrome  
            firefox: false, // Mozilla Firefox  
            msie: true, // Microsoft Internet Explorer  
            opera: true, // Opera  
            konqueror: true, // Konqueror (Linux)  
            unknown: true // Everything else  
        },
        display: ['firefox','chrome'],
        header: 'Your browser does not fully support this site.', // Header Text  
        paragraph1: 'You are currently using a browser not fully supported by this website. Some functionality will likely be broken.', // Paragraph 1  
        paragraph2: 'We suggest downloading and using one of the following browsers to use this site to its full capability:',  
        closeMessage: 'Close this window to continue anyway' // Message below close window link  
    }); // Customized Browsers  
    
    $('#password').keypress(function(e){
      if(e.keyCode==13)
      $('#loginbutton').click();
    });
    
    map = L.map('map', {
			center: AucklandLatLng,
			zoom: 7,
			layers: [grayscale]
		});
    
    // Add relevant data / icons / labels for new feature created
    map.on('draw:created', function (e) {
			var type = e.layerType,
				layer = e.layer;
            
            // Set the relevant symbology based on featureType
			if (type === 'marker') {
                featuretype = layer.options.icon.options.type;
			}
			if (type === 'polygon') {
                featuretype = layer.options.polyType
			}
            if (type === 'polyline') {
                featuretype = layer.options.lineType
            }
        
            // Add layer to our feature  group, and to snap guidelayers
			featureGroups[featuretype].addLayer(layer);
            snapguides.push(e.layer);
        
            layer.properties = {};
            layer.properties.LeafType = featuretype;
            askForFeatureDetails(layer);
            layer.on('click', function(e){
                setEditLayer(e);
            });
    });
    
    map.on('draw:deletestart', function(e){
        currentlyEditing = true;
    });
    map.on('draw:editstart', function(e){
        currentlyEditing = true;
    });
    map.on('draw:editstop', function(e){
        currentlyEditing = false;
    });
    map.on('draw:deletestop', function(e){
        currentlyEditing = false;
    });
    
    // Delete removes layers from drawnItems - we need to remove them from their featureGroup as well
    map.on('draw:deleted', function(e){
        e.layers.eachLayer(function(layer){
            featureGroups[layer.properties.LeafType].removeLayer(layer);
            
            // remove the layer from our snapguides array
            var index = snapguides.indexOf(layer);
            if (index > -1) {
                snapguides.splice(index, 1);
            }
        });
    });
    
    // Check for corresponding labels to add/remove along with layer being add/removed
    map.on('layeradd', function(e){
        id = e.layer._leaflet_id
        if (labelMarkerDic[id]){
            map.addLayer(labelMarkerDic[id]);
        }
        if (e.layer.on){
            var layer = e.layer;
            e.layer.on('contextmenu', function(e){askForFeatureDetails(layer)}); // right click to edit feature details
        }
    });
    map.on('layerremove', function(e){
        id = e.layer._leaflet_id
        if (labelMarkerDic[id]){
            map.removeLayer(labelMarkerDic[id]);
        }
    });
    
    // Auth handling    
        var logindialog = null;
    firebase.auth().onAuthStateChanged(function(user) {
        if (user) {
            if (logindialog){
                logindialog.dialog("close");
            }
            $('#userLoginContainer').hide();
            $('#fbName').text(user.email);
            $('#userDetails').show();
            userSwitch(user.uid);
        } else {
            logindialog = $( "#dialog-login" ).dialog({
              autoOpen: true,
              height: 250,
              width: 350,
              modal: true,
              draggable: false,
              resizable: false,
              dialogClass: "no-close"
            });
            $('#userLoginContainer').show();
            $('#userDetails').hide();
            $('#mapControls').hide();
            resetLayers();
            
            if (getUrlParameter('sampleuser') && getUrlParameter('sampleuser').length > 0){
                var num = getUrlParameter('sampleuser')[0];
                $("#email").val("sample"+num);
                $("#password").val("sample"+num);
            }
        }
    });
    
    // Save dialog
    saveDialog = $( "#dialog-form" ).dialog({
      autoOpen: false,
      height: 400,
      width: 350,
      modal: true,
      buttons: {
        "Save map": saveGeoJson,
        Cancel: function() {
          saveDialog.dialog( "close" );
        }
      }
    });
    
    //Resize leaflet map dynamically
//    var mapmargin = $('#topbar').outerHeight();
    var mapmargin = "45";
    function resize(){
        $('#map').css("height", ($(window).height() - mapmargin));    
//        $('#map').css("margin-top",mapmargin);
    }
    $(window).on("resize", resize);
    window.dispatchEvent(new Event('resize'));
    
    LayersControl.addTo(map);
    
    
    logoBox = L.control({position: 'bottomleft'});
    logoBox.onAdd = function (map) {
        var container = L.DomUtil.create('div');
        $(container).html("<img style='width:80px' src='/images/agisbadge.png'/>");
        return container;
    };
    logoBox.addTo(map);
});
//
//// Bind UI
//$('.accordion').accordion(accordionOptions);

// Asks user for details about the Feature they just added
function askForFeatureDetails(layer) {
    if (!layer.properties || !layer.properties.LeafType){
        return;
    }
    var detailsPopup = L.popup({minWidth: 220, keepInView: true, closeOnClick: false });
    var content = '<span><b>Label</b></span><br/><input id="shapeName" type="text" '+getLabelPlaceholder(layer)+'/><br/><br/><span><b>Details</b></span><br/><textarea id="shapeDesc" cols="25" rows="5" '+getDetailsPlaceholder(layer)+'</textarea><br/><table id="featureAttributesList"></table><button onclick="addCustomAttributeField()">+ Add Attribute</button><br/><br/><input type="submit" id="okBtn" value="Save" onclick="saveFeatureDetails(\''+layer.properties.LeafType+'\','+layer._leaflet_id+')"/>';
//    var content = '<span><b>Label</b></span><br/><input id="shapeName" type="text" placeholder="eg \''+layer.properties.LeafType+'\'"/><br/><br/><input type="submit" id="okBtn" value="Save" onclick="saveFeatureDetails(\''+layer.properties.LeafType+'\','+layer._leaflet_id+')"/>';
    detailsPopup.setContent(content);
    detailsPopup.setLatLng(getLatLng(layer)); //calculated based on the e.layertype
    detailsPopup.openOn(map);
    
    // Add default attributes
    defaultAttrs = getDefaultAttributes(layer);
    alreadyAddedKeys = [];
    $.each(getDefaultAttributes(layer), function(key, value){
        $('#featureAttributesList').loadTemplate(
                "templates/featureattributedefaultrow.html",
                {
                    key: value.substring(5),
                    value: layer.properties[value]
                },
                { append: true, paged: false}
         );
        alreadyAddedKeys.push(value);
    });
    
    // Add custom attributes
    $.each(layer.properties, function(key, value){
        if (key.startsWith("diym_") && ($.inArray(key, alreadyAddedKeys) == -1 )){ // diym_ prefix used for all attributes we want to be able to edit in this view
            $('#featureAttributesList').loadTemplate(
                "templates/featureattributerow.html",
                {
                    key: key.substring(5),
                    value: value
                },
                { append: true, paged: false}
            );
        }
    });
    $('#shapeName').focus();
    $('#shapeName').keypress(function(e){
      if(e.keyCode==13)
        $('#okBtn').click();
    });
    $('#shapeDesc').keypress(function(e){
      if(e.keyCode==13)
        $('#okBtn').click();
    });
}

function getLabelPlaceholder(feature){
    if (feature.properties.LeafLabel){
        return 'value="'+feature.properties.LeafLabel+'"';
    } else if (Feature[feature.options.type] && Feature[feature.options.type].usecodelabel){ // for LMUs
        return 'value="'+feature.properties.LeafType[0]+'" disabled';
    } else if (feature.properties.LeafType){
        return 'placeholder="'+feature.properties.LeafType+'"';
    } else {
        return "";
    }
}
function getDetailsPlaceholder(feature){
    if (feature.properties.details){
        return '>'+feature.properties.details;
    } else if (Feature[feature.options.type] && Feature[feature.options.type].detailsuggestions){
        return 'placeholder="'+Feature[feature.options.type].detailsuggestions+'">';
    } else {
        return 'placeholder="Add more information about this feature">';
    }
}
function getDefaultAttributes(feature){
    if (Feature[feature.properties.LeafType] && Feature[feature.properties.LeafType].defaultattributes){
        return Feature[feature.properties.LeafType].defaultattributes.map(function(key){return "diym_"+key});
    } else {
       return null;
    }
}

// Returns 'middle' latlng for a given feature
function getLatLng(feature) {
    if (feature._latlng) {
        return feature._latlng; // Markers have just one latlng
    }
    else if (feature._latlngs){
        return feature.getBounds().getCenter();
    }
}

// Save name/details for the current feature. 
function saveFeatureDetails(featureType, featureID) {
    if (featureGroups[featureType]){
        feature = featureGroups[featureType].getLayer(featureID);
        var sName = document.getElementById("shapeName").value;
        var sDetails = document.getElementById("shapeDesc").value;
        feature.properties.LeafLabel = sName;
        feature.properties.details = sDetails;
        addLabelsToFeature(feature, sName, sDetails);
        
        // clear existing custom properties
        $.each(feature.properties, function(key, value){
            if (key.startsWith("diym_")){
                delete feature.properties[key]
            }
        });
        // add custom properties
        $.each($("#featureAttributesList tr"), function(row){
            inputs = $(this).find("input");
            key = inputs[0].value;
            data = inputs[1].value;
            if (key.length > 0){
                feature.properties["diym_"+key] = data;
            }
        });
    }
    map.closePopup();
}

function addCustomAttributeField(){
    $('#featureAttributesList').loadTemplate(
        "templates/featureattributerow.html",
        {
            key: "",
            value: ""
        },
        { append: true, paged: false}
    );
}

function addLabelsToFeature(feature, labeltext, details){
    if (details){
        feature.bindPopup(details);
    }
    
    // add the overlay label
    if (labeltext) {
        if (feature._latlng){ // hacky way to check if it's a point marker, rather than line or poly
            if (feature.label){
                feature.updateLabelContent(labeltext);
            } else {
                feature.bindLabel(labeltext, { noHide: true, className: 'markerLabel' });
                feature.showLabel();
            }
        } else {
            var latlng, classname, labelContents;
            if (feature.options.polyType) {
                latlng = getLatLng(feature);
                classname = "polyLabel";
                labelContents = '<div><p>'+labeltext+'</p><p class="size">'+(L.GeometryUtil.geodesicArea(feature._latlngs) * 0.0001).toFixed(2) + ' ha'+'</p></div>';
            }
            if (feature.options.lineType)  {
                latlng = feature._latlngs[0];
                classname = "lineLabel";
                labelContents = labeltext;
            }
            
            // create a 'ghost marker' to bind the label to
            var marker = new L.marker(latlng, { opacity: 0.01, draggable: true, icon: L.divIcon({className: 'labelDragHandle', iconAnchor: [0,0]}) });
            marker.bindLabel(labelContents, {noHide: true, className: 'featureLabel '+classname, offset: [0, 0] });
            labels.addLayer(marker);
            if (labelMarkerDic[feature._leaflet_id]) { // remove any existing label
                map.removeLayer(labelMarkerDic[feature._leaflet_id]);
            }
            labelMarkerDic[feature._leaflet_id] = marker;
            //labels.addTo(map);
            marker.showLabel();
        }
    }
}

// Base Maps
var mbAttr = 'Map data &copy; <a href="http://openstreetmap.org">OpenStreetMap</a> contributors, ' +
        '<a href="http://creativecommons.org/licenses/by-sa/2.0/">CC-BY-SA</a>, ' +
        'Imagery © <a href="http://mapbox.com">Mapbox</a>',
    // mbUrl = 'https://api.tiles.mapbox.com/v4/mapbox.light/{z}/{x}/{y}.png?access_token=pk.eyJ1IjoibWFwYm94IiwiYSI6ImNpandmbXliNDBjZWd2M2x6bDk3c2ZtOTkifQ._QA7i5Mpkd_m30IGElHziw',
    mbUrl = 'https://api.tiles.mapbox.com/v4/mapbox.light/{z}/{x}/{y}.png?access_token=pk.eyJ1IjoidHlsZXJncmlmZmluIiwiYSI6ImNpcjQzNGVvcTAxZ2xmaW5yaXFpcDAxeTgifQ.h5kYi9Fdnemz2lqlE4Gykw',
    linzUrl = 'http://tiles-a.data-cdn.linz.govt.nz/services;key=780af066229e4b63a8f9408cc13c31e8/tiles/v4/set=2/EPSG:3857/{z}/{x}/{y}.png';
var grayscale   = L.tileLayer(mbUrl, {id: 'mapbox.light', attribution: mbAttr, base:true, maxZoom: 20}),
    linz = L.tileLayer(linzUrl, {attribution: "LINZ Aerial Photography", base:true, maxZoom: 20});
var baseLayers = {
    "Grayscale": grayscale,
    "LINZ Aerial": linz,
//    "No basemap": null
};

var LayersControl = L.control.layers(baseLayers, {}, {
            position: 'topleft'});

// Registers the DrawControl to the layer that was clicked
function setEditLayer(e){
    if(!editsEnabled || (editingFeature === e.target.properties.LeafType || currentlyEditing)){
       return;
    }
    editingFeature = e.target.properties.LeafType;
    registerDrawControl(featureGroups[e.target.properties.LeafType], e.target.properties.LeafType);
}

// Registers drawControl (for edits) to the given featureGroup
function registerDrawControl(fGroup, type){
    removeDrawControl();
    
    // Add drawcontrol
    drawControl = new L.Control.Draw({
        position: 'topleft',
        draw: false, // Don't want Leaflet Draw's draw toolbar
        edit: {
            featureGroup: fGroup
        }
    });
    map.addControl(drawControl);
    
    // Customize the text of the drawControl
    if (type){
        L.drawLocal.edit.toolbar.actions.save.title = "Confirm changes";
        L.drawLocal.edit.toolbar.actions.save.text = "Confirm";
        L.drawLocal.edit.toolbar.buttons.edit = "Edit "+type+" features";
        L.drawLocal.edit.toolbar.buttons.editDisabled = "No "+type+" features to edit";
        L.drawLocal.edit.toolbar.buttons.remove = "Remove "+type+" features";
        L.drawLocal.edit.toolbar.buttons.removeDisabled = "No "+type+" features to remove.";
        L.drawLocal.edit.handlers.remove.tooltip.text = "Click a "+type+" feature to remove it.";
        
        // Add messagebox to indicate to user
        var box = L.control.messagebox({position: 'topleft', timeout: '2000'}).addTo(map);
        box.show('Edit controls switched to '+type+' features.');
    }
}

function removeDrawControl(){
    currentlyEditing = false;
    if (drawControl && drawControl._map){ // remove exisiting drawcontrol.
        map.removeControl(drawControl);
    }
}

// Populates the Location selector
function populateLocations(){
    $('#cover').show();
    // clear the contents and add placeholder
    $('#location').html(""); 
    $('#location').append('<option value="" disabled="" selected="">Select Location</option>');
    
    // add option for each location
    locationsRef = rootRef.ref("/location/");
    rolesRef = rootRef.ref("/roles/"+uid+"/locations/");
    rolesRef.once('value', function (snapshot) {
        var locList = snapshot.val()
        $.each(locList, function(index, element){
            locationsRef.child(index).once("value", function(loc){
                $('#location').append('<option value='+loc.key+'>'+loc.val().name+'</option>');
                $('#mapControls').show();
            });
        });
    });
    
    // Wait for locations to load up, then automatically select
    window.setTimeout(function(){
        if ($('#location').children('option[value]:not([disabled])').length == 1) {
            $('#location option[value]').prop('selected', true);
            $('#location').change();
            $('#location').hide();
        } else {
            $('#location').show();
            $('#cover').hide();
        }
    }, 2500);
    window.setTimeout(function(){
        if ($('#location').children('option[value]:not([disabled])').length > 1) {
            $('#location').show(); // in case for some reason the other locations were very slow to load.
        }
    }, 10000);
}

function resetInterface(){
    resetLayers();
    $('#location').html(""); 
    $('#featuregrid').html("");
    $('#saveButtonDiv').html("");
    $('#historylist').html("");
    $('#banner').html("");
}

// Feature Layers
var featureGroups = {}; 
var drawnItems = new L.FeatureGroup(); // parent feature group used to generate the geojson
var labels = new L.LayerGroup(); // display layer only - of labels for polylines and polygons

// Resets all feature information. Called on login/logout location switch.
function resetLayers(){
    // Clear all layers off the map
//    map.eachLayer(function(layer){
//        if (!(layer.options && layer.options.base)){
//            map.removeLayer(layer);
//        }
//    });
    snapguides = [];
    drawnItems.clearLayers();
    labels.clearLayers();
    clearOverlays();
    // Reset feature groups to empty groups
    labels = new L.LayerGroup();
    $.each(featureGroups, function(index, element){ // Create a FeatureGroup for each type of Feature
        featureGroups[index] = new L.FeatureGroup();
//        featureGroups[index] = L.featureGroup.subGroup(drawnItems);
        map.addLayer(featureGroups[index]);
    });
    // Add the FeatureGroups to parent FeatureGroup (drawnItems)
    addFeatureGroupsToParentGroup();
    // Add back to map
    map.addLayer(drawnItems);
    map.addLayer(labels);
}

function addFeatureGroupsToParentGroup(){
    drawnItems.clearLayers(); 
    $.each(featureGroups, function(index, element){
        drawnItems.addLayer(element); // add the layer to the parent layergroup
    });
}

//Retrieves features from db and populates the view
function populateFeatureGrid(){
    $('#featuregrid').html(""); // clear the contents
    featureRef = rootRef.ref("/features/");
    rootRef.ref('/roles/'+uid).once('value', function(roleSnap){
        var userFeatures = roleSnap.val().features;
        editsEnabled = roleSnap.val().role == 'editor' || roleSnap.val().role == 'manager';
    
        if (editsEnabled){
            $("#saveButtonDiv").html("<br><br><br><button class=\"w3-btn w3-light-green\"  id=\"savebutton\">Save Changes</button><br/><br>");
            $("#savebutton").on("click", function(){
                saveDialog.dialog("open");
            });
        }
        
        featureRef.on('child_added', function (featureSnapshot) {
            if (!(userFeatures[featureSnapshot.key])){
                return;
            }
            // Will be called with a featureSnapshot for each child under the /features/ node
            $('#featuregrid').append('<h3 class="'+featureSnapshot.key+'FeatureUI">'+featureSnapshot.val().name +'<input id="toplvlcheckbx'+featureSnapshot.val().name+'" class=\"w3-check w3-right toplvlcheckbx\" type=\"checkbox\" checked/><label class="showLayer" for="toplvlcheckbx'+featureSnapshot.val().name+'"></label></h3>');
            var div = document.createElement('div');
            div.className = "accordion accordionDiv "+featureSnapshot.key+"FeatureUI";
            featureSnapshot.forEach(function(childSnapshot){
                featureArray = childSnapshot.val();
                if ($.isArray(featureArray)){
                    $(div).append('<h3>'+childSnapshot.key +'<input id="midlvlcheckbx'+featureSnapshot.val().name+childSnapshot.key+'" class=\"w3-check w3-right midlvlcheckbx\" type=\"checkbox\" checked/><label class="showLayer" for="midlvlcheckbx'+featureSnapshot.val().name+childSnapshot.key+'"></label></h3>');
                    var html = '<table class="w3-striped w3-hoverable featureTable"><thead><tr></tr></thead><tbody>';
                    $.each(featureArray, function(index, element){
            //            row = document.createElement("tr");
                        featureGroups[element.name] = new L.FeatureGroup(); // Create our categorised featurelayer reference
                        featureGroups[element.name].addTo(map);
                        //set customised description for the feature, if present for this location
                        if (locationCustomDescriptions && locationCustomDescriptions[element.name]){
                            element.description = locationCustomDescriptions[element.name];
                        }
                        Feature[element.name] = element; // save symbology for this feature type
                        

                            html += '<tr>';
                            if (editsEnabled) {
                                html += '<td title="Add '+element.description+'" onclick="addFeature(\''+element.name+'\')"';
                            } else {
                                html += '<td ';
                            }
                            var detailFn = null;
                            if (element.family == "marker"){
                                // Set icon's size and anchor point
                                var iconWidth = iconSize[element.size];
                                element.options.icon.iconSize = [iconWidth,iconWidth]; // square
                                element.options.icon.iconAnchor = [iconWidth,iconWidth].map(function(obj){
                                    return obj / 2; // Icon Anchor is in the middle of the icon.
                                });
                                html +='class="clickable featurebutton" style="background-image:url(\''+element.options.icon.iconUrl+'\')"';
                                detailFn = updateCount;
                            }else if (element.family == "polyline") {
                                html+= 'class="clickable"><div class="linefeaturebutton"><div class="line" style="background-color:'+element.options.color+';height:'+element.options.weight+'px;"/></div';
                                detailFn = updateLength;
                            }else if (element.family == "polygon") {
                                html+= 'class="clickable"><div class="polyfeaturebutton" style="background-color:'+element.options.fillColor+';border-color:'+element.options.color+'"/';
                                detailFn = updateArea;
                            }
                            html += '></td><td><span class="description">' + element.description + '</span>';
                            if (element.editable_description && editsEnabled) {
                                html += '<span class="featureedit" onclick="editfeaturedesc(this)"><img src="/images/edit.svg" style="width:20px;" /></span>'
                            }
                            html += '<br/><span class="detail" data-featuretype="'+element.name+'"></span>';
                        
                            // Hardcoded Heatmap button for pest traps
                            if (element.name == 'Codling Moth Trap' || element.name == 'Leafroller Trap'){
                                html += '<br/><span class="heatmapbutton" onclick="toggleHeatMap(\''+element.name+'\', \'diym_Pest Count\')">Show/Hide Heatmap</span>';
                            }
                                
                            html += '</td><td><input featuretype="'+element.name+'" id="showhide'+element.name+'" class="w3-check showLayer" type="checkbox" checked><label class="showLayer" for="showhide'+element.name+'"></label>';
                            if (element.family != "marker") {
                                html += '<br/><input featuretype="'+element.name+'" id="showhidelabel'+element.name+'" class="w3-check showLabel" type="checkbox" checked><label class="showLabel" for="showhidelabel'+element.name+'"></label>';
                            }    
                            html += "</td></tr>";
                            // attach detail-update handling
                            featureGroups[element.name].on('layeradd', detailFn);
                            featureGroups[element.name].on('layerremove', detailFn);
                    });
                    html += '</tbody></table>';
                    $(html).appendTo($(div));
                    $(div).appendTo('#featuregrid');
                    $(div).accordion(accordionOptions);
                    $(div).accordion("refresh");
                }
            });
            addFeatureGroupsToParentGroup();

            // add show/hide functionality to the checkboxes we added
            $('input[type=checkbox].showLayer').change(
            function(){
                //event.preventDefault();
                layer = featureGroups[$(this).attr('featuretype')];
                if(this.checked) {
                    map.addLayer(layer);
                } else {
                    if (map.hasLayer(layer)){
                        map.removeLayer(layer);
                    }
               }
            });
            
            // add show/hide functionality to the checkboxes we added
            $('input[type=checkbox].showLabel').change(
            function(){
                //event.preventDefault();
                var featuretype = featureGroups[$(this).attr('featuretype')];
                var show = this.checked;
                $.each(featuretype._layers, function(index, value){
                    if (labelMarkerDic[index]){
                        if(show) {
                            map.addLayer(labelMarkerDic[index]);
                        } else {
                            if (map.hasLayer(labelMarkerDic[index])){
                                map.removeLayer(labelMarkerDic[index]);
                            }
                       }
                    }
                });
            });


        // Propogated checkbox selection
        $('#featuregrid input[type="checkbox"]').click(function(e) {
            e.stopPropagation();
        });
        $('#featuregrid label').click(function(e) {
            e.stopPropagation();
        });
        $('#featuregrid .toplvlcheckbx').change(function(e) {
            var checked = $(this).prop('checked');
            $(this).parent().next().find(".midlvlcheckbx").prop('checked', checked).change();
        });
        $('#featuregrid .midlvlcheckbx').change(function(e) {
            var checked = $(this).prop('checked');
            $(this).parent().next().find('input[type="checkbox"]').prop('checked', checked).change();
        });

            //accordionise our new feature menu grid thing
        $('#featuregrid').accordion(accordionOptions);
        $('#featuregrid').accordion("refresh" );
        }, function (err) {
          // code to handle read error
        });
    })
}

function updateArea(e){
    var type = e.layer.options.type;
    var group = this;
    $('.featureTable span.detail[data-featuretype="'+type+'"]').text(function(){
        var sumArea = 0;
        $.each(group._layers, function(index, element){
            sumArea += L.GeometryUtil.geodesicArea(element.getLatLngs());
        });
        return (sumArea / 10000).toFixed(2)+" ha";
    });
}
function updateLength(e){
    var type = e.layer.options.lineType;
    var group = this;
    $('.featureTable span.detail[data-featuretype="'+type+'"]').text(function(){
        var sumLength = 0;
        $.each(group._layers, function(index, element){
            sumLength += L.GeometryUtil.length(element);
        });
        return sumLength.toFixed(0)+"m";
    });
}
function updateCount(e){
    var type = e.layer.options.icon.options.type;
    $('.featureTable span.detail[data-featuretype="'+type+'"]').text(this.getLayers().length);
}

function deleteEdit(location, editKey){
    if (confirm("Are you sure you want to delete this map version?")){
        editRef = rootRef.ref("edit/"+location+"/"+editKey);
        editRef.once("value", function(data){
            jsonRef = rootRef.ref("geojson/"+data.val().geojsonid);
            jsonRef.remove();
        });
        editRef.remove();
    }
}

function userLogin() {
    var email = getEmail();
    firebase.auth().signInWithEmailAndPassword(email, $("#password").val()).catch(function(error) {
      // Handle Errors here.
      var errorCode = error.code;
      var errorMessage = error.message;
      alert("Failed to log in: "+errorMessage)
      return;
    });
}

function logout(){
    if (drawControl && drawControl._map) { // http://stackoverflow.com/questions/33146809/find-out-if-a-leaflet-control-has-already-been-added-to-the-map
        map.removeControl(drawControl);
    }
    resetInterface();
    firebase.auth().signOut().then(function() {
        $('#logindeetz').hide();
          $('#fbName').text("");
          $('#userLoginContainer').show();
        userSwitch(-1);
        $('#featuregrid').removeData(); // clear the contents
        $('#featuregrid').html(""); // clear the contents
    }, function(error) {
      alert("Failed to sign out..");
    });
}



function userSwitch(val) {
    uid = val; 
    
    if (val == -1) {//logout
        resetLayers();
        userRef = null;
        return;
    }
    populateLocations();

    // set userRef
    userRef = rootRef.ref("/user/"+val);
    
    userRef.once('value', function(data){
        if (data.val() && data.val().name){
            $('#fbName').text(data.val().name);
            if (data.val().logo) {
                $('#banner').html(getLogo(data.val().logo));
            }
        }
    });
    
    rootRef.ref("/roles/"+uid).once('value', function(snap){
        if (snap.val().role == 'manager'){
            $('#custombuttons').html("");
            $('#custombuttons').append('<li class="w3-right actionButton"><a target="_blank" href="http://www.diymapper.com/diy_mapper_customer_signup_form/">Add A User</a></li>');
        }
    });
}

//https://github.com/jieter/leaflet-clonelayer
function cloneLayer (layer) {
    var options = layer.options;

    // Tile layers
    if (layer instanceof L.TileLayer) {
        return L.tileLayer(layer._url, options);
    }
    if (layer instanceof L.ImageOverlay) {
        return L.imageOverlay(layer._url, layer._bounds, options);
    }

    // Marker layers
    if (layer instanceof L.Marker) {
        return L.marker(layer.getLatLng(), options);
    }
    if (layer instanceof L.circleMarker) {
        return L.circleMarker(layer.getLatLng(), options);
    }

    // Vector layers
    if (layer instanceof L.Rectangle) {
        return L.rectangle(layer.getBounds(), options);
    }
    if (layer instanceof L.Polygon) {
        if (layer.properties){ // Used to differentiate 'nogozone' from regular features. We don't want to clone NoGoZone polys, they're being cloned as GeoJSON already.
            return L.polygon(layer.getLatLngs(), options);
        } else {
            return;
        }
    }
    if (layer instanceof L.Polyline) {
        return L.polyline(layer.getLatLngs(), options);
    }
    // MultiPolyline is removed in leaflet 1.0.0
    if (L.MultiPolyline && layer instanceof L.MultiPolyline) {
        return L.polyline(layer.getLatLngs(), options);
    }
    // MultiPolygon is removed in leaflet 1.0.0
    if (L.MultiPolygon && layer instanceof L.MultiPolygon) {
        return L.multiPolygon(layer.getLatLngs(), options);
    }
    if (layer instanceof L.Circle) {
        return L.circle(layer.getLatLng(), layer.getRadius(), options);
    }
    if (layer instanceof L.GeoJSON) {
        return L.geoJson(layer.toGeoJSON(), options);
    }

    // layer/feature groups
    if (layer instanceof L.LayerGroup || layer instanceof L.FeatureGroup) {
        var layergroup = L.layerGroup();
        layer.eachLayer(function (inner) {
            layergroup.addLayer(cloneLayer(inner));
        });
        return layergroup;
    }
    
    // Label markers..
    if (layer instanceof L.Class) {
        var marker = new L.marker(layer._latlng, { opacity: 0.01, draggable: true, icon: L.divIcon({className: 'labelDragHandle', iconAnchor: [0,0]}) });
        marker.bindLabel(layer._content, options);
        return marker;
    }

    throw 'Unknown layer, cannot clone this layer: '+layer;
}

function getMapZoom() {
    return map.getZoom();
}

function getMapCentre(){
    return map.getCenter();
}

function editfeaturedesc(span){
    featureName = $(span.parentNode).find("span.detail").attr('data-featuretype');
    descNode = $(span.parentNode).find("span.description");
    desc = descNode.text();
    descNode.hide();
    $(span).hide();
    var inpt = $('<input class="editinput" type="text" value="'+desc+'" />')
    inpt.appendTo($(span.parentNode));
    btn = document.createElement('button');
    btn.className = "saveedit";
    btn.textContent = "Save";
    $(btn).appendTo($(span.parentNode));
    btn.onclick = function(){
        setCustomDescription(featureName, inpt.val());
        descNode.text(inpt.val());
        descNode.show();
        $(span).show();
        inpt.remove();
        $(this).hide();
    }
}

function toggleHeatMap(featureType, attribute, max = 1, radius = 25, blur = 15){
    
    // leaflet-heat.js
//    if (map.hasLayer(heatMapLayer)){
//        map.removeLayer(heatMapLayer);
//    }
//    var latlngs = featureGroups[featureType].getLayers().map(function(layer){return new L.latLng([layer._latlng.lat, layer._latlng.lng, parseInt(layer.properties[attribute], 10)])});
//    heatMapLayer = L.heatLayer(latlngs, {max: max, radius: radius, blur: blur}).addTo(map);
    
    // leaflet-heatmap.js
    if (map.hasLayer(heatMapLayer)){
        map.removeLayer(heatMapLayer);
        return;
    }
    heatMapLayer = new HeatmapOverlay({
      // radius should be small ONLY if scaleRadius is true (or small radius is intended)
      // if scaleRadius is false it will be the constant radius used in pixels
      "radius": 0.002,
      "maxOpacity": .7, 
//      // scales the radius based on map zoom
      "scaleRadius": true, 
//      // if set to false the heatmap uses the global maximum for colorization
//      // if activated: uses the data maximum within the current map boundaries 
//      //   (there will always be a red spot with useLocalExtremas true)
//      "useLocalExtrema": true,
      // which field name in your data represents the latitude - default "lat"
      latField: 'lat',
      // which field name in your data represents the longitude - default "lng"
      lngField: 'lng',
      // which field name in your data represents the data value - default "value"
      valueField: 'count'
    });
    var latlngs = featureGroups[featureType].getLayers().map(function(layer){return {lat: layer._latlng.lat, lng: layer._latlng.lng, count: parseInt(layer.properties[attribute], 10)}});
    heatMapLayer.addTo(map);
    heatMapLayer.setData({max: 7, data: latlngs});
    
}
