<%@page contentType="text/html" pageEncoding="UTF-8"%>
<!DOCTYPE HTML PUBLIC "-//W3C//DTD HTML 4.01 Transitional//EN"
    "http://www.w3.org/TR/html4/loose.dtd">

<html>
    <head>
        <meta charset="utf-8" content="">
        <meta http-equiv="X-UA-Compatible" content="IE=edge,chrome=1">
        <title></title>
        <meta name="description" content="">
        <meta name="viewport" content="width=device-width">
        <link rel="stylesheet" href="css/normalize.min.css">
        <link rel="stylesheet" href="css/main.css">
        <script async="" src="//www.google-analytics.com/analytics.js"></script>
        <script src="js/jquery-1.9.1.min.js" type="text/javascript"></script>
        <!--script src="https://code.jquery.com/jquery-1.11.2.min.js"></script-->
        <style type="text/css"></style>
        <!--        <script src="js/main.js" type="text/javascript"></script>-->
        <link rel="icon" type="image/ico" href="img/favicon.ico">

        <!--<link rel="stylesheet" href="https://maxcdn.bootstrapcdn.com/bootstrap/3.3.5/css/bootstrap.min.css">-->
        <script src="https://maxcdn.bootstrapcdn.com/bootstrap/3.3.5/js/bootstrap.min.js"></script>
        <link rel="stylesheet" href="OpenLayers/css/ol.css" type="text/css">
        <script  type="text/javascript" src="OpenLayers/build/ol.js"></script>
        <script  type="text/javascript" src="js/utill/underscore-min.js"></script>
        <script  type="text/javascript" src="js/utill/moment.js"></script>
        <link rel="stylesheet" href="jquery-ui/jquery-ui.css">
        <script type="text/javascript" src="jquery-ui/jquery-ui.js"></script>
        <script type="text/javascript" src="jquery-ui/jquery-ui-combobox.js"></script>
        <script>
            var FluData = {
                url: "http://localhost:8080",
                serialNumber: 0,
                layerNames: new Array(),
                //layers: new Array(),
                zoomLevel: 7.5,
                ceneter: [-83.0, 40.22],
                //view : null,
                layerIndex: 0,
                map: null,
                fromDate: null,
                toDate: null,
                pageName: "index.jsp",
                initMap: function() {
                    var tView = new ol.View({
                        center: ol.proj.transform(this.ceneter, 'EPSG:4326', 'EPSG:3857'),
                        zoom: this.zoomLevel
                    });

                    var tMap = new ol.Map({
                        layers: [],
                        target: 'map',
                        view: tView
                    });

                    var baseLayer = new ol.layer.Group({
                        style: 'AerialWithLabels',
                        visible: true,
                        layers: [
                            new ol.layer.Tile({
                                source: new ol.source.MapQuest({layer: 'sat'})//osm
                            }),
                            new ol.layer.Tile({
                                source: new ol.source.MapQuest({layer: 'hyb'})
                            })
                        ]
                    });

                    this.map = tMap;
                    this.map.addLayer(baseLayer);
                },
                getActiveLayerIndex: function() {
                    this.layerIndex = (this.layerIndex + 1) > this.layerNames.length ? 1 : (this.layerIndex + 1);
                    return this.layerIndex;
                },
                loadLayerSwitcher: function(){
               
                   var groupName = "";
                   var groupNumber = -1;
                    for (i = 0; i < this.layerNames.length; i++) {
                        var m = moment(this.layerNames[i].JSDate);
                        var newGroupName = m.format("MMMM YYYY");
                        var newLayerName = m.format("MMMM DD"); 
                        
                        if(groupName === "" || groupName !== newGroupName){
                            //create new group
                            groupNumber = groupNumber + 1;
                            
                            groupName = newGroupName;
                            $("div.layer-list").append("<div class=\"layer-group\"></div>");
                            $("div.layer-list .layer-group:eq(" + groupNumber + ")").addClass(m.format("MMMYYYY"));
                            
                            $("div.layer-list .layer-group:eq(" + groupNumber + ")").append("<span class=\"layer-group-name\">" + groupName + "</span>");
                            $("div.layer-list .layer-group:eq(" + groupNumber + ")").append("<ul class=\"layer-items\"></ul>");
                            
                              
                            $("div.layer-list .layer-group:eq(" + groupNumber + ") ul").append("<li class=\"" + m.format("MMMDD") + "\">" + newLayerName + "</li>");
                                                        
                        }else{   
                           $("div.layer-list .layer-group:eq(" + groupNumber + ") ul").append("<li class=\"" + m.format("MMMDD") + "\">" + newLayerName + "</li>");
                            
                        }
                    }
                    
                    $("div.layer-list .layer-group span").click(function() {
                        if($("ul", $(this).parent()).css("display") === "block"){
                            $("ul", $(this).parent()).css("display", "none");
                        }else{
                            $("ul", $(this).parent()).css("display", "block");
                        }
                     });
                },
                loadMapLayers: function() {
                    //TO-DO
                    //keep the base layer, remove last two layers and replace them

                    var tempLayers = new Array();
                    for (i = 0; i < this.layerNames.length; i++) {

                        var wmsLayer = new ol.layer.Image({
                            source: new ol.source.ImageWMS({
                                url: this.url + '/geoserver/wms',
                                params: {'LAYERS': this.layerNames[i].Name},
                                serverType: 'geoserver',
                                crossOrigin: ''
                            }),
                            visible: true
                        });

                        tempLayers.push(wmsLayer);
                        //this.map.addLayer(wmsLayer);
                    }

                    for (i = 0; i < tempLayers.length; i++) {
                        //tempLayers[i].setVisible(false);
                        this.map.addLayer(tempLayers[i]);
                    }
                    
                    this.loadLayerSwitcher();
                    
                    setInterval(this.doLayerAnimation, 1500, this);
                    
                },
                doLayerAnimation: function(that) {
                    that.getActiveLayerIndex();

                    that.map.getLayers().forEach(function(layerData, idx) {
                        if (idx !== 0) {
                            if (idx === that.layerIndex) {
                                $("#divDate").html(that.layerNames[idx - 1].DayCaption);
                                layerData.setVisible(true);
                                
                                $("div.layer-list .layer-group ul li.select").removeClass("select");
                                $("div.layer-list .layer-group ul li."+ moment(that.layerNames[idx - 1].JSDate).format("MMMDD")).addClass("select");                                
                            } else {

                                layerData.setVisible(false);
                            }
                        }
                    }, that);
                },
                loadLayerNames: function() {
                    var d1 = this.getUrlParameter("f");
                    var d2 = this.getUrlParameter("t");
                    if(d1 && d2){
                        this.fromDate = moment(d1, "YYYY-MM-DD");
                        this.toDate = moment(d2, "YYYY-MM-DD");
                    }else{
                        this.fromDate = null;
                        this.toDate = null;
                    }
                    
                    $.ajax({
                        type: "GET",
                        url: this.url + "/geoserver/rest/workspaces/flu/coveragestores.json",
                        dataType: "json",
                        context: this,
                        success: function(data) {
                            var listLayers = new Array();

                            if (data.coverageStores !== null && data.coverageStores.coverageStore[0] !== null) {
                                var stores = data.coverageStores.coverageStore;

                                var fDate = this.fromDate;
                                var tDate = this.toDate;
                                var skipDateChecks = false;
                                 if(!fDate || !tDate){
                                     skipDateChecks = true;
                                 }
                                
                                $.each(stores, function(key, store) {
                                    var strDate = store.name.replace("flustore", "");
                                    var layerName = "flu:" + strDate;
                                    var momentDate = moment(strDate, "YYYYMMMDD");
                                    
                                    if(skipDateChecks || (momentDate.diff(fDate, "days") >= 0 && momentDate.diff(tDate, "days") <= 0)){                                        
                                        var objDay = {JSDate: momentDate.toDate(), Name: layerName, DayCaption: momentDate.format("MMMM DD YYYY")};
                                        listLayers.push(objDay);
                                    }
                                });

                                listLayers.sort(function(a, b) {
                                    return a.JSDate.getTime() - b.JSDate.getTime();
                                });

                                //TO-DO
                                //copy list layer to the this.layers
                                for (i = 0; i < listLayers.length; i++) {
                                    this.layerNames.push(listLayers[i]);
                                }

                                this.loadMapLayers();
                            }
                        },
                        error: function(error) {
                            console.log(error);
                        }
                    });
                },
                getUrlParameter : function(sParam) {
                    var sPageURL = decodeURIComponent(window.location.search.substring(1)),
                        sURLVariables = sPageURL.split('&'),
                        sParameterName,
                        i;

                    for (i = 0; i < sURLVariables.length; i++) {
                        sParameterName = sURLVariables[i].split('=');

                        if (sParameterName[0] === sParam) {
                            return sParameterName[1] === undefined ? true : sParameterName[1];
                        }
                    }
                }
            };

            $(document).ready(function() {

                var status = true;

                $('#layer-select').change(function() {
                    var layers = map.getLayers().getArray();
                    //layers.pop();

                    var style = $(this).find(':selected').val();
                    var i, ii;
                    for (i = 0, ii = layers.length; i < ii; ++i) {
                        //layers[i].set('visible', (layers[i].get('style') == style));
                        status = !status;
                        layers[1].set('visible', !status);
                        layers[2].set('visible', !status);
                    }
                });
                //$('#layer-select').trigger('change');


                
                $("#accordion").accordion({
                    active: 1,
                    heightStyle: "fill"
                });
                
                $("#fromdatepicker").datepicker({
                    defaultDate: "-1w",
                    changeMonth: true,
                    numberOfMonths: 2,
                    onClose: function(selectedDate) {
                        $("#todatepicker").datepicker("option", "minDate", selectedDate);
                    }
                });
                $("#fromdatepicker").datepicker("option", "showAnim", "slideDown");


                $("#todatepicker").datepicker({
                    defaultDate: "+1w",
                    changeMonth: true,
                    numberOfMonths: 2,
                    onClose: function(selectedDate) {
                        $("#fromdatepicker").datepicker("option", "maxDate", selectedDate);
                    }
                });
                $("#todatepicker").datepicker("option", "showAnim", "slideDown");

               
                
                $("#combobox").combobox();
                
                $("#combobox").combobox({
                    select: function(event, ui ) {
                        var val = ui.item.value;                        
                        var mToday =  moment(new Date());
                        
                        if(val === "PastWeek"){
                          var today = mToday.format("YYYY-MM-DD");
                          var weekAgo = mToday.subtract(6, 'day').format("YYYY-MM-DD");
                          window.location = FluData.pageName + "?op=c&f=" + weekAgo + "&t=" + today;
                        }else if(val === "PastMonth"){
                          var today = mToday.format("YYYY-MM-DD");
                          var monthAgo = mToday.subtract(1, 'month').format("YYYY-MM-DD");
                          window.location = FluData.pageName + "?op=c&f=" + monthAgo + "&t=" + today;
                        }else if(val ==="AllTime"){
                            window.location = FluData.pageName;
                        }else{
                          
                        }
                    }
                  });
                
                $("#btnLoadMap").button();
                $("#btnLoadMap").click(function() {
                    event.preventDefault();  

                    var date1 = moment($("#fromdatepicker").datepicker("getDate")).format("YYYY-MM-DD");                    
                    var date2 = moment($("#todatepicker").datepicker("getDate")).format("YYYY-MM-DD");
                    window.location = FluData.pageName + "?op=c&f=" + date1 + "&t=" + date2;
                    
                });
                
                FluData.initMap();
                FluData.loadLayerNames();
            });

        </script>
    </head>
    <body>
        <div>
            <!--Header--->
            <div id="header">
                <div class="title-area">
                    <!--<img src="img/logo.png" alt="" />-->
                    <div>
                        Fluwitter
                        <br>
                        GeoInformatics Laboratory (GIL), SEES</div>
                </div>
                <div class="menu-area">
                    <div class="thin-strip">
                    </div>
                    <div class="menu-wrapper">
                        <div>
                            <ul class="nav">
                                <li><a href="index.jsp">Home</a></li>
                                <li><a href="#">About</a>
                                    <div>                            
                                        <div class="nav-column">
                                            <h3>
                                                About</h3>
                                            <ul>
                                                <li><a href="http://geogis.bgsu.edu/staff-members.php">People</a></li>
                                                <li><a href="http://geogis.bgsu.edu/contact.php">Contact</a></li>
                                            </ul>
                                        </div>
                                    </div>
                                </li>
                                <li><a href="#">Research</a>
                                    <div>                            
                                        <div class="nav-column">
                                            <h3>
                                                Research</h3>
                                            <ul>
                                                <li><a href="proinfo.html">Project Info</a></li>
                                                <li><a href="proposal.html">Proposal</a></li>    
                                                <li><a href="thesis.html">Thesis</a></li>
                                                <li><a href="posters.html">Posters</a></li>                                           
                                                <li><a href="results.html">Results</a></li>
                                            </ul>
                                        </div>
                                    </div>
                                </li>
                                <li><a href="technology.html">Technology</a>
                                    <div>                            
                                        <div class="nav-column">
                                            <h3>Technology</h3>
                                            <ul>
                                                <li><a href="technical.html">Technical Info</a></li>
                                                <li><a href="source.html">Source Code</a></li>
                                            </ul>
                                        </div>
                                    </div>
                                </li>
                                <li><a href="http://geogis.bgsu.edu">GEOGIS</a></li>
                            </ul>
                        </div>
                    </div>
                    <div class="thin-strip">
                    </div>
                </div>
            </div>

            <div id="main-area">                
                <div id="content-area">
                    <!-- LEFT AREA-->
                    <div id="content-area-left">
                        <!-- SECTION HEAD -->
                        <div class="news-head">
                            <div>
                                INFLUENZA REPORTING CONFIDENCE IN OHIO - <span id="divDate">2015 June 10</span>
                            </div>
                        </div>                    

                        <!-- SECTION DETAILS -->
                        <!--                        <div itemscope="" itemtype="http://data-vocabulary.org/CollegeOrUniversity" class="lab-desc">                        
                                                    The GeoInformatics Laboratory (GIL) acts as a focus for research into geoinformatics across the School of Earth Environment and Society (SEES) and other disciplines at the University. Geoinformatics involves a range of different synergetic activities including the collection, processing, analysis and visualization of spatial data sets. This emphasis on multidisciplinary approaches creates a strong focus on different application areas including environmental problem-solving, human-environment interactions, collaborative spatial decision-making, and other cross-disciplinary approaches that use applications of geographic information science (GIScience) and remote sensing. <br><br>
                                                    Examples of the areas of study of our team of researchers features a strong focus on geomorphometric analysis and digital terrain representation, modeling landslide processes under undisturbed and disturbed conditions, computational approaches for understanding potential avian impact from offshore wind farms, predicting invasive species in wetland environment and other remote sensing land use approaches aimed at inventory, monitoring and  modeling of conditions. The most current research projects underway are in the area of web-based GIS, such as collaborative spatial decision support systems (C-SDSSs), public participatory GIS (PPGIS), volunteered geographic information (VGI), and 3D geo-information derived from laser scanning techniques.
                                                </div>-->
                        <div class="container-fluid">
                            <div class="row-fluid">
                                <div class="span12">
                                    <div id="map" class="map" style="height: 650px;"></div>
                                </div>
                            </div>
                        </div>
                    </div>
                    <!-- RIGHT AREA-->
                    <div id="content-area-right">
                        <div class="event-area">
                            <div class="event-area-head">
                                EXPLORE <span>Fluwitter</span> </div>
                            <div class="event-area-sub-head">
                                Explore influenza spread under different criteria</div>
                            <div>
                                <div id="accordion">
                                    <h3>Display Criteria</h3>
                                    <div>                                       
                                        <p>View Option:
                                        <select id="combobox">
                                          <option value="">Select one...</option>
                                          <option value="PastWeek">Past Week</option>
                                          <option value="PastMonth">Past Month</option>
                                          <option value="AllTime">All Time</option>
                                          <option value="ChooseTimePeriod">Choose Time Period</option>                  
                                        </select>
                                        </p>  
                                        <p>From <input type="text" id="fromdatepicker" size="10" ></p>
                                        <p>To &nbsp;&nbsp;&nbsp; <input type="text" id="todatepicker" size="10"></p>
                                        <a id="btnLoadMap" href="#">Load Map</a>
                                        
                                        <p>
                                            Data of today aggregate with the data of four previous days in order to visualize the present day situation.
                                            Read the methodology for more information.
                                        </p>
                                    </div>
                                    <h3>Layers</h3>
                                    <div>
                                        <div class="layer-list">
                                            <!--div class="layer-group">
                                                <span class="layer-group-name">July 2015</span>
                                                <ul class="layer-items">
                                                   <li>15 July</li>
                                                   <li>16 July</li>
                                                   <li>17 July</li>
                                                </ul>  
                                            </div>
                                            <div class="layer-group">
                                                <span class="layer-group-name">June 2015</span>
                                                <ul class="layer-items">
                                                   <li>15 June</li>
                                                   <li>16 June</li>
                                                   <li>17 June</li>
                                                </ul>  
                                            </div-->                                            
                                        </div>
                                        <p>
                                            Click on layer group names to expand and collapse.
                                        </p>
                                    </div>
                                    <h3>Legend</h3>
                                    <div>
                                        <img src="http://localhost:8080/geoserver/wms?FORMAT=image%2Fjpeg&TRANSPARENT=true&SERVICE=WMS&VERSION=1.1.1&REQUEST=GetLegendGraphic&EXCEPTIONS=application%2Fvnd.ogc.se_xml&LAYER=flu%3A2015Jun01&scale=3466753&legend_options=fontSize:10;bgColor:0xFFFFEE;dpi:130;fontStyle:normal"/>
                                        <p>
                                            To be implemented.
                                        </p>
                                    </div>
                                    <h3>Graphs</h3>
                                    <div>
                                        <p>
                                            To be implemented.
                                        </p>
                                    </div>
                                </div>                                
                            </div>
                        </div>
                    </div>


                    <!--FOOTER-->
                    <div id="footer">
                        <br>
                        © 2014 Geoinformatics Laboratory, School of Earth, Environment and Society, Bowling Green State University
                    </div>            </div>
            </div>
        </div>        
    </body>
</html>