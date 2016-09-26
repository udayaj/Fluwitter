var mapPanel, tree, map, compareMode = true, secondSeries = null;
Ext.BLANK_IMAGE_URL = 'ext-3.4.1/resources/images/default/s.gif';
Ext.chart.Chart.CHART_URL = 'ext-3.4.1/resources/charts.swf';

Ext.onReady(function() {
    Ext.state.Manager.setProvider(new Ext.state.CookieProvider());

    var vlow = 7.4, low = 14.8, mid = 22.2, high = 29.6, highest = 37;

    var lon = -9209424.70928;
    var lat = 4918010.57951;
    var zoom = 7;
    var maxExtent = new OpenLayers.Bounds(-20037508.34, -20037508.34, 20037508.34, 20037508.34);
    var maxResolution = 156543.0339;

    var proj_webMercatorProjection = new Proj4js.Proj("EPSG:900913");
    var proj_geographicalProjection = new Proj4js.Proj("EPSG:4326");
    var proj_oregonSouthProjection = new Proj4js.Proj("EPSG:2270");

    var webMercatorProjection = new OpenLayers.Projection("EPSG:900913");
    var geographicalProjection = new OpenLayers.Projection("EPSG:4326");
    var oregonSouthProjection = new OpenLayers.Projection("EPSG:2270");

    //transform center to EPSG:900913
    var center_lonlat = new OpenLayers.LonLat(lon, lat);

    //transformed coordinates of the bounding box from EPSG:2270 to EPSG:900913
    var native_bbox = new OpenLayers.Bounds(-9441236.503745414, 4636160.115755578, -8963444.97386776, 5159013.149974987);

    var gmap = new OpenLayers.Layer.Google("Google Streets", {type: G_NORMAL_MAP, sphericalMercator: true});
    var gsat = new OpenLayers.Layer.Google("Google Satellite", {type: G_SATELLITE_MAP, sphericalMercator: true});
    var omap = new OpenLayers.Layer.OSM("Open Street");
    gmap.projection = gsat.projection = omap.projection = webMercatorProjection;

    var bwms = new OpenLayers.Layer.WMS("County Boundries", "/geoserver/wms?",
            {
                layers: "ohio:county",
                transparent: true,
                format: "image/png"
            },
    {'visibility': true, 'singleTile': 'true'});
    //'reproject': true, 

    var select = new OpenLayers.Layer.Vector("Selection", {styleMap:
                new OpenLayers.Style(OpenLayers.Feature.Vector.style["select"])
    });

    var hover = new OpenLayers.Layer.Vector("Hover");

    var options = {
        projection: webMercatorProjection,
        units: "m",
        maxResolution: maxResolution,
        maxExtent: maxExtent,
        numZoomLevels: 20,
        controls: [new OpenLayers.Control.Navigation(),
            new OpenLayers.Control.LayerSwitcher(),
            new OpenLayers.Control.PanZoomBar()
                    //,new OpenLayers.Control.DragFeature(bwms)
        ],
        allOverlays: false
    };

    map = new OpenLayers.Map(options);
    map.addLayers([gmap, gsat, omap, bwms, hover, select]);

    var control = new OpenLayers.Control.GetFeature({
        protocol: OpenLayers.Protocol.WFS.fromWMSLayer(bwms),
        box: true,
        hover: true,
        multipleKey: "shiftKey",
        toggleKey: "ctrlKey",
        modifiers: {multiple: false, toggle: false}
    });

    control.events.register("featureselected", this, function(e) {
        //compareMode = criteriaForm.getForm().findField('grpahType').getValue().inputValue == "single" ? false: true;

        if (!compareMode) {
            select.removeAllFeatures();
        }

        if (select.features.length < 2) {
            select.addFeatures([e.feature]);
        } else {
            select.removeFeatures([select.features[0]]);
            select.addFeatures([e.feature]);
        }
        setContyComboBoxes();
    });
    control.events.register("featureunselected", this, function(e) {
        select.removeFeatures([e.feature]);
        setContyComboBoxes();
    });
    control.events.register("hoverfeature", this, function(e) {
        hover.addFeatures([e.feature]);
    });
    control.events.register("outfeature", this, function(e) {
        hover.removeFeatures([e.feature]);
    });
    function setContyComboBoxes() {
        if (select.features.length == 0) {
            criteriaForm.getForm().findField('county1').clearValue();
            criteriaForm.getForm().findField('county2').clearValue();
        } else if (select.features.length == 1) {
            criteriaForm.getForm().findField('county1').setValue(select.features[0].attributes.name);
            criteriaForm.getForm().findField('county2').clearValue();
        } else if (select.features.length == 2) {
            criteriaForm.getForm().findField('county1').setValue(select.features[0].attributes.name);
            criteriaForm.getForm().findField('county2').setValue(select.features[1].attributes.name);
        } else {
            Ext.MessageBox.alert("Error", "Error occurred!");
        }
    }

    map.addControl(control);
    control.activate();
    map.setCenter(new OpenLayers.LonLat(lon, lat), zoom);

    mapPanel = new GeoExt.MapPanel({
        title: "Unemployment in Ohio",
        border: true,
        region: "center",
        map: map,
        extent: native_bbox,
        center: center_lonlat,
        zoom: zoom
    });

    var legendURL = "/geoserver/wms?FORMAT=image%2Fgif&TRANSPARENT=true&SERVICE=WMS&VERSION=1.1.1&REQUEST=GetLegendGraphic&EXCEPTIONS=application%2Fvnd.ogc.se_xml&LAYER=ohio%3Acounty&scale=3466753&legend_options=fontSize:8;bgColor:0xFFFFEE;dpi:130;fontStyle:bold";

    //mapPanel.map.events.register("click", mapPanel.map, queryDatabase);    
    var legendPanel = new Ext.form.FormPanel({
        title: "Legend (Unemployment Rate)",
        width: 225,
        //height: 150,        
        html: "<img src='" + legendURL + "' style='width:150px;text-align:center'></img>"
    });
    
    var notePanel = new Ext.form.FormPanel({
        width: 300,
        border: true,
        padding: 3,
        //height: 150,        
        html: "<b>Note:</b><ul><li>\"Shift\" key to select multiple counties</li><li>\"Ctrl\" key to toggle select/deselect counties</li></ul>"
    });
    
    var correlationPanel = new Ext.form.FormPanel({
        width: 300,
        border: true,
        padding: 3,
        //height: 150,        
        html: "<h2>Correlation coefficient: </h2><h2>Trend line: </h2><h2>R<sup>2</sup>: </h2>"
    });

    function processResponse(response) {
        var gmlReader = new OpenLayers.Format.GML({extractAttributes: true});
        var features = gmlReader.read(response.responseText);
        select.removeAllFeatures();

        var county1 = criteriaForm.getForm().findField('county1').getValue();
        var county2 = criteriaForm.getForm().findField('county2').getValue();
        var temp = [];
        for (var i = 0; i < features.length; i++) {
            if (features[i].attributes.name == county1 || features[i].attributes.name == county2) {
                temp.push(features[i]);
            }
        }

        if (temp.length > 0) {
            select.addFeatures(temp)
        }

        var tempNames = [];
        tempNames.push(county1);
        if (county2 != "")
        {
            tempNames.push(county2);
        }

        //call the graph
        getUnemploymentData(tempNames);
    }

    function setSelectedCounties() {
        OpenLayers.Request.issue({
            url: '/geoserver/wfs',
            method: 'GET',
            params: {
                service: 'WFS',
                version: '1.0.0',
                request: 'GetFeature',
                typeName: 'ohio:county'
            },
            success: processResponse
        });
    }

    var listCounty = [['Adams', 'Adams'],
        ['Allen', 'Allen'],
        ['Ashland', 'Ashland'],
        ['Ashtabula', 'Ashtabula'],
        ['Athens', 'Athens'],
        ['Auglaize', 'Auglaize'],
        ['Belmont', 'Belmont'],
        ['Brown', 'Brown'],
        ['Butler', 'Butler'],
        ['Carroll', 'Carroll'],
        ['Champaign', 'Champaign'],
        ['Clark', 'Clark'],
        ['Clermont', 'Clermont'],
        ['Clinton', 'Clinton'],
        ['Columbiana', 'Columbiana'],
        ['Coshocton', 'Coshocton'],
        ['Crawford', 'Crawford'],
        ['Cuyahoga', 'Cuyahoga'],
        ['Darke', 'Darke'],
        ['Defiance', 'Defiance'],
        ['Delaware', 'Delaware'],
        ['Erie', 'Erie'],
        ['Fairfield', 'Fairfield'],
        ['Fayette', 'Fayette'],
        ['Franklin', 'Franklin'],
        ['Fulton', 'Fulton'],
        ['Gallia', 'Gallia'],
        ['Geauga', 'Geauga'],
        ['Greene', 'Greene'],
        ['Guernsey', 'Guernsey'],
        ['Hamilton', 'Hamilton'],
        ['Hancock', 'Hancock'],
        ['Hardin', 'Hardin'],
        ['Harrison', 'Harrison'],
        ['Henry', 'Henry'],
        ['Highland', 'Highland'],
        ['Hocking', 'Hocking'],
        ['Holmes', 'Holmes'],
        ['Huron', 'Huron'],
        ['Jackson', 'Jackson'],
        ['Jefferson', 'Jefferson'],
        ['Knox', 'Knox'],
        ['Lake', 'Lake'],
        ['Lawrence', 'Lawrence'],
        ['Licking', 'Licking'],
        ['Logan', 'Logan'],
        ['Lorain', 'Lorain'],
        ['Lucas', 'Lucas'],
        ['Madison', 'Madison'],
        ['Mahoning', 'Mahoning'],
        ['Marion', 'Marion'],
        ['Medina', 'Medina'],
        ['Meigs', 'Meigs'],
        ['Mercer', 'Mercer'],
        ['Miami', 'Miami'],
        ['Monroe', 'Monroe'],
        ['Montgomery', 'Montgomery'],
        ['Morgan', 'Morgan'],
        ['Morrow', 'Morrow'],
        ['Muskingum', 'Muskingum'],
        ['Noble', 'Noble'],
        ['Ottawa', 'Ottawa'],
        ['Paulding', 'Paulding'],
        ['Perry', 'Perry'],
        ['Pickaway', 'Pickaway'],
        ['Pike', 'Pike'],
        ['Portage', 'Portage'],
        ['Preble', 'Preble'],
        ['Putnam', 'Putnam'],
        ['Richland', 'Richland'],
        ['Ross', 'Ross'],
        ['Sandusky', 'Sandusky'],
        ['Scioto', 'Scioto'],
        ['Seneca', 'Seneca'],
        ['Shelby', 'Shelby'],
        ['Stark', 'Stark'],
        ['Summit', 'Summit'],
        ['Trumbull', 'Trumbull'],
        ['Tuscarawas', 'Tuscarawas'],
        ['Union', 'Union'],
        ['Van Wert', 'Van Wert'],
        ['Vinton', 'Vinton'],
        ['Warren', 'Warren'],
        ['Washington', 'Washington'],
        ['Wayne', 'Wayne'],
        ['Williams', 'Williams'],
        ['Wood', 'Wood'],
        ['Wyandot', 'Wyandot']];

    var criteriaForm = new Ext.form.FormPanel({
        frame: true,
        //title: 'Filter',
        bodyStyle: 'padding:5px 5px 0',
        width: 300,
        height: '100%',
        fieldDefaults: {
            msgTarget: 'side',
            labelWidth: 55
        },
        defaultType: 'textfield',
        defaults: {
            anchor: '100%'
        },
        items: [
            {
                xtype: 'radiogroup',
                fieldLabel: 'Graph Type',
                name: 'grpahType',
                items: [
                    {boxLabel: 'Single', name: 'comparisionMode', inputValue: 'single'},
                    {boxLabel: 'Comparision', name: 'comparisionMode', inputValue: 'compare', checked: true}
                ],
                listeners: {
                    change: function(radioGrp, radioBtn) {
                        compareMode = radioBtn.inputValue == "single" ? false : true;
                        if (!compareMode) {
                            var combo2Val = criteriaForm.getForm().findField('county2').getValue();
                            if (select.features.length > 1 && combo2Val != "") {
                                select.removeFeatures(select.getFeaturesByAttribute("name", combo2Val));
                            }
                            criteriaForm.getForm().findField('county2').clearValue();
                            criteriaForm.getForm().findField('county2').disable();
                        } else {
                            criteriaForm.getForm().findField('county2').enable();
                        }
                    }
                }
            },
            new Ext.form.ComboBox({
                name: 'county1',
                fieldLabel: 'County 1',
                typeAhead: true,
                triggerAction: 'all',
                lazyRender: true,
                mode: 'local',
                store: new Ext.data.ArrayStore({
                    id: 0,
                    fields: [
                        'val',
                        'display'
                    ],
                    data: listCounty
                }),
                valueField: 'val',
                displayField: 'display',
                listeners: {
                    select: function(combo, selection) {

                    }
                }
            }),
            new Ext.form.ComboBox({
                name: 'county2',
                fieldLabel: 'County 2',
                typeAhead: true,
                triggerAction: 'all',
                lazyRender: true,
                mode: 'local',
                store: new Ext.data.ArrayStore({
                    id: 0,
                    fields: [
                        'val',
                        'display'
                    ],
                    data: listCounty
                }),
                valueField: 'val',
                displayField: 'display',
                listeners: {
                    select: function(combo, selection) {

                    }
                }
            }),
            {
                xtype: 'datefield',
                anchor: '100%',
                fieldLabel: 'From Date',
                name: 'fromDate',
                format: 'm-d-Y',
                value: '01-01-1970',
                minValue: '01-01-1970',
                maxValue: '12-31-2010'
            },
            {
                xtype: 'datefield',
                anchor: '100%',
                fieldLabel: 'To Date',
                name: 'toDate',
                format: 'm-d-Y',
                value: '12-31-2010',
                minValue: '01-01-1970',
                maxValue: '12-31-2010'
            },
            {
                fieldLabel: 'Measurement Noise',
                name: 'mNoise',
                allowBlank: false,
                value: 0.1
            },
            {
                fieldLabel: 'Process Noise',
                name: 'pNoise',
                allowBlank: false,
                value: 0.00001
            }
        ],
        buttons: [
            {
                text: 'Compare',
                handler: function() {
                    var ct1 = criteriaForm.getForm().findField('county1').getValue();
                    var ct2 = criteriaForm.getForm().findField('county2').getValue();

                    if (compareMode && (ct1 == "" || ct2 == ""))
                    {
                        Ext.MessageBox.alert("Invalid", "Select two counties for comparision!");
                    }
                    else if (!compareMode && ct1 == "")
                    {
                        Ext.MessageBox.alert("Invalid", "Select a county!");
                    }
                    else
                    {
                        var single = (ct2 == "") ? true : false;

                        win.items.items[0].series[0].displayName = ct1;
                        if (single) {
                            win.setTitle("Unemployment Rate - " + ct1);
                            if (win.items.items[0].series.length == 2) {
                                secondSeries = win.items.items[0].series.pop();
                            }
                        } else {
                            win.setTitle("Unemployment Rate - " + ct1 + " vs " + ct2);
                            if (win.items.items[0].series.length == 1) {
                                win.items.items[0].series.push(secondSeries);
                            }
                            win.items.items[0].series[1].displayName = ct2;
                        }
                        setSelectedCounties();
                    }
                }
            },
            {
                text: 'Show Corelation',
                handler: function() {
                    var ct1 = criteriaForm.getForm().findField('county1').getValue();
                    var ct2 = criteriaForm.getForm().findField('county2').getValue();
                    if (!compareMode || ct1 == "" || ct2 == "")
                    {
                        Ext.MessageBox.alert("Invalid", "Select two counties for comparision!");
                    } else {
                        if (chartStore.data.length < 1) {
                            Ext.MessageBox.alert("Invalid", "Click \"Compare\" to populate data at first.");
                        } else {
                            winCorelate.setTitle("Unemployment Rate Correlation Between " + ct1 + " and " + ct2);
                            getStats();
                            winCorelate.show();
                        }
                    }
                }
            },
            {
                text: 'Apply Kalman Filter',
                handler: function() {
                    var ct1 = criteriaForm.getForm().findField('county1').getValue();
                    var ct2 = criteriaForm.getForm().findField('county2').getValue();
                    if (!compareMode || ct1 == "" || ct2 == "")
                    {
                        Ext.MessageBox.alert("Invalid", "Select two counties for comparision!");
                    } else {
                        if (chartStore.data.length < 1) {
                            Ext.MessageBox.alert("Invalid", "Click \"Compare\" to populate data at first.");
                        } else {
                            winKalman.setTitle("Kalman Filter Applied Unemployment Rates - " + ct1 + " vs " + ct2);
                            var arrTmp = [ct1, ct2];
                            getKalmanStats(arrTmp);
                            winKalman.show();
                        }
                    }
                }
            }]
    });

    var chartStore = new Ext.data.JsonStore({
        fields: [{ name : 'DateTaken', type: 'date'},
                 { name : 'Rate1', type: 'float' },
                 { name : 'Rate2', type: 'float' },
                 { name : 'RegX', type: 'float' },
                 { name : 'Regy', type: 'float' }],
        data: []
    });

    // create the Grid1
    var resultGrid1 = new Ext.grid.GridPanel({
        store: chartStore,
        columns: [
            {
                id: "Month",
                header: "Month",
                width: 50,
                sortable: true,
                renderer: Ext.util.Format.dateRenderer('Y M'),
                dataIndex: "DateTaken"
            },
            {
                header: "Rate",
                width: 50,
                sortable: true,
                dataIndex: "Rate1"
            }
        ],
        stripeRows: true,
        autoExpandColumn: 'Month',
        height: 250,
        width: 250,
        bodyStyle: 'padding:5px 5px 0',
        stateful: true,
        stateId: 'grid'
    });

    // create the Grid2
    var resultGrid2 = new Ext.grid.GridPanel({
        store: chartStore,
        columns: [
            {
                id: "Month",
                header: "Month",
                width: 50,
                sortable: true,
                renderer: Ext.util.Format.dateRenderer('Y M'),
                dataIndex: "DateTaken"
            },
            {
                header: "Rate",
                width: 50,
                sortable: true,
                dataIndex: "Rate2"
            }
        ],
        stripeRows: true,
        autoExpandColumn: 'Month',
        height: 350,
        width: 300,
        bodyStyle: 'padding:5px 5px 0',
        stateful: true,
        stateId: 'grid'
    });

    function queryDatabase(e) {
        chartStore.removeAll();

        var params = {
            REQUEST: "GetFeatureInfo",
            EXCEPTIONS: "application/vnd.ogc.se_xml",
            BBOX: map.getExtent().toBBOX(),
            SERVICE: "WMS",
            INFO_FORMAT: 'application/json',
            QUERY_LAYERS: ['ohio:county'],
            FEATURE_COUNT: 50,
            Layers: 'ohio:county',
            WIDTH: map.size.w,
            HEIGHT: map.size.h,
            format: 'image/png',
            styles: map.layers[3].params.STYLES,
            srs: map.layers[3].params.SRS,
            propertyName: 'name'
        };

        // handle the wms 1.3 vs wms 1.1 issue
        if (map.layers[3].params.VERSION == "1.3.0") {
            params.version = "1.3.0";
            params.j = parseInt(e.xy.x);
            params.i = parseInt(e.xy.y);
        } else {
            params.version = "1.1.1";
            params.x = parseInt(e.xy.x);
            params.y = parseInt(e.xy.y);
        }

        // merge filters
        if (map.layers[3].params.CQL_FILTER != null) {
            params.cql_filter = map.layers[3].params.CQL_FILTER;
        }
        if (map.layers[3].params.FILTER != null) {
            params.filter = map.layers[3].params.FILTER;
        }
        if (map.layers[3].params.FEATUREID) {
            params.featureid = map.layers[3].params.FEATUREID;
        }

        OpenLayers.Request.GET({
            url: "http://localhost:8080/geoserver/ohio/wms",
            params: params,
            success: function(res) {
                var arrCounty = new Array();
                var count = Ext.decode(res.responseText).features.length;
                var tempArr = Ext.decode(res.responseText).features;
                for (var i = 0; i < count; i++) {
                    arrCounty[i] = tempArr[i].properties.name;
                }
                getUnemploymentData(arrCounty);
            },
            failure: function(err) {

            }
        });

        OpenLayers.Event.stop(e);
    }

    var kalmanChartStore = new Ext.data.JsonStore({
        fields: [{ name : 'DateTaken', type: 'date'},
                 { name : 'KRate1', type: 'float' },
                 { name : 'KRate2', type: 'float' },
                 { name : 'KRateDiff', type: 'float' }],
        data: []
    });

    function getUnemploymentData(arrCounty) {
        // Construct the query URL
        var url = "OhioUnemployment";

        if (arrCounty.length < 1) {
            return false;
        } else if (arrCounty.length == 1) {
            url += "?county1=" + arrCounty[0];
        } else if (arrCounty.length == 2) {
            url += "?county1=" + arrCounty[0] + "&county2=" + arrCounty[1];
        }

        if (criteriaForm.getForm().findField('fromDate').getValue() && criteriaForm.getForm().findField('fromDate').getValue() != "")
        {
            var from = Ext.util.Format.date(criteriaForm.getForm().findField('fromDate').getValue(), 'Y-m-d');
            url += "&from=" + from;
        }

        if (criteriaForm.getForm().findField('toDate').getValue() && criteriaForm.getForm().findField('toDate').getValue() != "")
        {
            var to = Ext.util.Format.date(criteriaForm.getForm().findField('toDate').getValue(), 'Y-m-d');
            url += "&to=" + to;
        }

        var xmlhttp;
        if (window.XMLHttpRequest)
        {// code for IE7+, Firefox, Chrome, Opera, Safari
            xmlhttp = new XMLHttpRequest();
        }
        else
        {// code for IE6, IE5
            xmlhttp = new ActiveXObject("Microsoft.XMLHTTP");
        }

        xmlhttp.onreadystatechange = function() {
            if (xmlhttp.readyState == 4 && xmlhttp.status == 200)
            {
                var jsonObj = Ext.decode(xmlhttp.responseText);
                //dateFormat: "m-d-Y"
                var item = Ext.data.Record.create([
                    {name: "DateTaken", type: "date"},
                    {name: "Rate1", type: "float"},
                    {name: "Rate2", type: "float"},
                    {name : 'RegX', type: 'float' },
                    {name : 'Regy', type: 'float' }
                ]);

                chartStore.removeAll();
                
                for (var i = 0; i < jsonObj.length; i++) {
                    //console.log(Ext.util.Format.date(jsonObj[i].DateTaken, 'Y-m'));
                    //var arrStr = jsonObj[i].DateTaken.split("-");
                    //var str = arrStr[2] + "-" + arrStr[0] + "-" + arrStr[1];
                    
                    var record = new item({
                        DateTaken: jsonObj[i].DateTaken,
                        Rate1: jsonObj[i].Rate1,
                        Rate2: jsonObj[i].Rate2,
                        RegX: null,
                        RegY: null
                    });

                    chartStore.add(record);
                }
                chartStore.commitChanges();
                win.show();
            }
        };

        xmlhttp.open("GET", url, true);
        xmlhttp.send();
    }

    function getStats() {
        var ct1 = criteriaForm.getForm().findField('county1').getValue();
        var ct2 = criteriaForm.getForm().findField('county2').getValue();
        
        // Construct the query URL
        var url = "OhioUnempCorrelation";
        url += "?county1=" + ct1 + "&county2=" + ct2;

        var from = null;
        if (criteriaForm.getForm().findField('fromDate').getValue() && criteriaForm.getForm().findField('fromDate').getValue() != "")
        {
            from = Ext.util.Format.date(criteriaForm.getForm().findField('fromDate').getValue(), 'Y-m-d');
            url += "&from=" + from;
        }

        var to = null;
        if (criteriaForm.getForm().findField('toDate').getValue() && criteriaForm.getForm().findField('toDate').getValue() != "")
        {
            to = Ext.util.Format.date(criteriaForm.getForm().findField('toDate').getValue(), 'Y-m-d');
            url += "&to=" + to;
        }

        var xmlhttp;
        if (window.XMLHttpRequest)
        {// code for IE7+, Firefox, Chrome, Opera, Safari
            xmlhttp = new XMLHttpRequest();
        }
        else
        {// code for IE6, IE5
            xmlhttp = new ActiveXObject("Microsoft.XMLHTTP");
        }

        xmlhttp.onreadystatechange = function() {
            if (xmlhttp.readyState == 4 && xmlhttp.status == 200)
            {
                var jsonObj = Ext.decode(xmlhttp.responseText);           
                setRegression(jsonObj.slope, jsonObj.intercept, jsonObj.rSqr);
                var interceptSign = jsonObj.intercept >= 0 ? "+ " : "";
                var strHTML = "<h2>Correlation coefficient: <span style='color:red;font-style:bold;'>" + jsonObj.crVal + "</span></h2>";
                strHTML = strHTML + "<h2>Trend line: <span style='color:black;font-style:bold;'> y = " + jsonObj.slope + "x " + interceptSign + jsonObj.intercept + "</span></h2>";
                strHTML = strHTML + "<h2>R<sup>2</sup>: <span style='color:red;font-style:bold;'>" + jsonObj.rSqr + "</span></h2>";
                correlationPanel.update(strHTML);
            }
        };

        xmlhttp.open("GET", url, true);
        xmlhttp.send();
    }
    
    function setRegression(slope, intercept, rSqr){
        var minRate1Obj =_.min(chartStore.data.items, function(item){ return item.data.Rate1; });
        var maxRate1Obj =_.max(chartStore.data.items, function(item){ return item.data.Rate1; });
        
        var x1 = minRate1Obj.data.Rate1;
        var x2 = maxRate1Obj.data.Rate1;
        var y1 = (slope * x1) + intercept;
        var y2 = (slope * x2) + intercept;
        
        var item = Ext.data.Record.create([
                    {name: "DateTaken", type: "date"},
                    {name: "Rate1", type: "float"},
                    {name: "Rate2", type: "float"},
                    {name : 'RegX', type: 'float' },
                    {name : 'Regy', type: 'float' }
                ]);
        
        var record1 = new item({
                        DateTaken: minRate1Obj.data.DateTaken,
                        Rate1: x1,
                        Rate2: minRate1Obj.data.Rate2,
                        RegX: null,
                        RegY: y1
                    });
        var record2 = new item({
                        DateTaken: maxRate1Obj.data.DateTaken,
                        Rate1: x2,
                        Rate2: maxRate1Obj.data.Rate2,
                        RegX: null,
                        RegY: y2
                    });

        chartStore.add(record1);
        chartStore.add(record2);
        chartStore.commitChanges();
    }
    
    function getKalmanStats(arrCounty) {
        // Construct the query URL
        var url = "KalmanFilterPrediction";

        if (arrCounty.length < 1) {
            return false;
        } else if (arrCounty.length == 1) {
            url += "?county1=" + arrCounty[0];
        } else if (arrCounty.length == 2) {
            url += "?county1=" + arrCounty[0] + "&county2=" + arrCounty[1];
        }

        if (criteriaForm.getForm().findField('fromDate').getValue() && criteriaForm.getForm().findField('fromDate').getValue() != "")
        {
            var from = Ext.util.Format.date(criteriaForm.getForm().findField('fromDate').getValue(), 'Y-m-d');
            url += "&from=" + from;
        }

        if (criteriaForm.getForm().findField('toDate').getValue() && criteriaForm.getForm().findField('toDate').getValue() != "")
        {
            var to = Ext.util.Format.date(criteriaForm.getForm().findField('toDate').getValue(), 'Y-m-d');
            url += "&to=" + to;
        }
        
        if (criteriaForm.getForm().findField('mNoise').getValue() && criteriaForm.getForm().findField('mNoise').getValue() != "")
        {
            var mNoise = criteriaForm.getForm().findField('mNoise').getValue().trim();
            url += "&mNoise=" + mNoise;
        }       
        
        if (criteriaForm.getForm().findField('pNoise').getValue() && criteriaForm.getForm().findField('pNoise').getValue() != "")
        {
            var pNoise = criteriaForm.getForm().findField('pNoise').getValue().trim();
            url += "&pNoise=" + pNoise;
        }  

        var xmlhttp;
        if (window.XMLHttpRequest)
        {// code for IE7+, Firefox, Chrome, Opera, Safari
            xmlhttp = new XMLHttpRequest();
        }
        else
        {// code for IE6, IE5
            xmlhttp = new ActiveXObject("Microsoft.XMLHTTP");
        }

        xmlhttp.onreadystatechange = function() {
            if (xmlhttp.readyState == 4 && xmlhttp.status == 200)
            {
                var jsonObj = Ext.decode(xmlhttp.responseText);
                //dateFormat: "m-d-Y"
                var item = Ext.data.Record.create([
                    {name: "DateTaken", type: "date"},
                    {name: "KRate1", type: "float"},
                    {name: "KRate2", type: "float"},
                    {name : 'KRateDiff', type: 'float'}
                ]);

                kalmanChartStore.removeAll();
                
                for (var i = 0; i < jsonObj.length; i++) {
                    
                    var record = new item({
                        DateTaken: jsonObj[i].DateTaken,
                        KRate1: jsonObj[i].KRate1,
                        KRate2: jsonObj[i].KRate2,
                        KRateDiff: jsonObj[i].KRateDiff
                    });

                    kalmanChartStore.add(record);
                }
                kalmanChartStore.commitChanges();
                winKalman.show();
            }
        };

        xmlhttp.open("GET", url, true);
        xmlhttp.send();
    }
    
    var LayerNodeUI = Ext.extend(GeoExt.tree.LayerNodeUI, new GeoExt.tree.TreeNodeUIEventMixin());

    var treeConfig = [
        {
            nodeType: "gx_baselayercontainer",
            expanded: true
        },
        {
            nodeType: "gx_overlaylayercontainer",
            expanded: true,
            loader: {
                baseAttrs: {
                    uiProvider: "layernodeui"
                }
            }
        }];

    // create the tree with the configuration from above
    tree = new Ext.tree.TreePanel({
        border: false,
        region: "north",
        title: "Layers",
        split: true,
        height: 230,
        //collapsible: true,
        //collapseMode: "mini",
        autoScroll: true,
        plugins: [
            new GeoExt.plugins.TreeNodeRadioButton({
                listeners: {
                    "radiochange": function(node) {
                        Ext.MessageBox.alert("Information", node.text + " is now the active layer.");
                    }
                }
            })
        ],
        loader: new Ext.tree.TreeLoader({
            applyLoader: false,
            uiProviders: {
                "layernodeui": LayerNodeUI
            }
        }),
        root: {
            nodeType: "async",
            children: treeConfig
        },
        listeners: {
            "radiochange": function(node) {
                Ext.MessageBox.alert("Information", node.layer.name + " is now the the active layer.");
            }
        },
        rootVisible: false,
        lines: false
    });

    var viewport = new Ext.Viewport({
        layout: 'border',
        items: [
            // create instance immediately
            new Ext.BoxComponent({
                region: 'north',
                height: 80, // give north and south regions a height
                autoEl: {
                    tag: 'div',
                    html: "<img src='img/bannar.jpg' width='100%' height='100%'/>" +
                            "<div style='position:absolute;top:18px;left:53px;font-size: 30px;font-weight:bold;color:#FFFFFF;'>Unemployment Rates - Ohio Counties</div>" +
                            "<div style='position:absolute;top:15px;left:50px;font-size: 30px;font-weight:bold;color:#CC0000;'>Unemployment Rates - Ohio Counties</div>"

                }
            }),
            {
                // lazily created panel (xtype:'panel' is default)
                region: 'south',
                //contentEl: 'south',
                html: "<div style='text-align:center;font-weight:bold;'>&copy; 2014 Geoinformatics Laboratory, School of Earth, Environment and Society, Bowling Green State University</div>",
                split: true,
                height: 25,
                minSize: 100,
                maxSize: 200,
                collapsible: false,
                //collapsed: true,
                //title: 'Footer',
                margins: '0 0 0 0'
            }, {
                region: 'east',
                title: '',
                collapsible: true,
                split: true,
                width: 225, // give east and west regions a width
                minSize: 200,
                maxSize: 400,
                margins: '0 5 0 0',
                layout: 'fit', // specify layout manager for items
                items: [{
                        border: false,
                        iconCls: 'info',
                        region: 'center',
                        items: [tree, legendPanel]
                    }]
            }, {
                region: 'west',
                id: 'west-panel', // see Ext.getCmp() below
                title: '',
                split: true,
                width: 300,
                minSize: 175,
                maxSize: 300,
                collapsible: true,
                margins: '0 0 0 5',
                layout: {
                    type: 'accordion',
                    animate: true
                },
                items: [{
                        title: '<b>Options and Settings</b>',
                        border: false,
                        iconCls: 'settings',
                        region: 'center',
                        items: [criteriaForm, notePanel, correlationPanel]
                    },
                    {
                        title: '<b>County-1 Dataset</b>',
                        border: false,
                        iconCls: 'grid',
                        region: 'center',
                        layout: 'fit',
                        items: [resultGrid1]
                    },
                    {
                        title: '<b>County-2 Dataset</b>',
                        border: false,
                        iconCls: 'grid',
                        region: 'center',
                        layout: 'fit',
                        items: [resultGrid2]
                    }]
            },
            // in this instance the TabPanel is not wrapped by another panel
            // since no title is needed, this Panel is added directly
            // as a Container
            new Ext.TabPanel({
                region: 'center', // a center region is ALWAYS required for border layout
                deferredRender: false,
                activeTab: 0, // first tab initially active
                items: [mapPanel]
            })]
    });
    // get a reference to the HTML element with id "hideit" and add a click listener to it 
    Ext.get("hideit").on('click', function() {
        // get a reference to the Panel that was created with id = 'west-panel' 
        var w = Ext.getCmp('west-panel');
        // expand or collapse that Panel based on its collapsed property state
        w.collapsed ? w.expand() : w.collapse();
    });

    /*-----------------Load Grid and Graph--------------------------*/
    var win = new Ext.Window({
        iconCls: 'info',
        width: 800,
        height: 600,
        //hidden: true,
        maximizable: true,
        title: 'Unemployment Rate - Ohio',
        autoShow: false,
        closeAction: 'hide',
        layout: 'fit',
        items: {
            xtype: 'linechart',
            store: chartStore,
            url: 'ext-3.4.1/resources/charts.swf',
            xField: 'DateTaken',
            yField: 'Rate1',
            chartStyle: {
                animationEnabled: true,
                font: {
                    name: 'Tahoma',
                    color: 0x444444,
                    size: 11
                },
                dataTip: {
                    padding: 5,
                    border: {
                        color: 0x99bbe8,
                        size: 1
                    },
                    background: {
                        color: 0xDAE7F6,
                        alpha: .9
                    },
                    font: {
                        name: 'Tahoma',
                        color: 0x15428B,
                        size: 10,
                        bold: true
                    }
                },
                xAxis: {
                    majorGridLines: {size: 0, color: 0xeeeeee}
                },
                yAxis: {
                    majorGridLines: {size: 0, color: 0xeeeeee}
                }
            },
            extraStyle: {
                animationEnabled: true,
                legend: {
                    display: 'bottom',
                    padding: 0,
                    font: {
                        family: 'Tahoma',
                        size: 13
                    }
                },
                xAxis: {
                    labelRotation: -90
                },
                yAxis: {
                    titleRotation: -90
                },
                minorTicks: {
                    display: "none"
                },
                majorTicks: {
                    display: "outside",
                    size: 1,
                    color: 0x000000,
                    length: 3
                }
            },
            yAxis: new Ext.chart.NumericAxis({
                displayName: 'Unemployment Rate',
                title: 'Unemployment Rate',
                labelRenderer: Ext.util.Format.numberRenderer('0,0'),
                majorUnit: 1,
                minorUnit: 0.5
            }),
            xAxis: new Ext.chart.CategoryAxis({
                displayName: 'Month',
                title: 'Month',
                labelRenderer: Ext.util.Format.dateRenderer('Y'),
                calculateCategoryCount: true
            }),
            tipRenderer: function(chart, record, index, series) {
                if (series.yField == 'Rate1') {
                    return Ext.util.Format.number(record.data.Rate1, '0,0.00') + '% unemployment for ' + Ext.util.Format.date(record.data.DateTaken, 'Y M');
                } else {
                    return Ext.util.Format.number(record.data.Rate2, '0,0.00') + '% unemployment for ' + Ext.util.Format.date(record.data.DateTaken, 'Y M');
                }
            },
            series: [{
                    type: 'line',
                    displayName: "County-1 Rate",
                    yField: 'Rate1',
                    fill: true,
                    smooth: true,
                    title: 'Top 5 Products',  
                    style: {
                        color: 0x3399FF,
                        alpha: 0,
                        fillColor: 0x3399FF,
                        fillAlpha: 1,
                        'stroke-width': 0.2
                    }
                },
                {
                    type: 'line',
                    displayName: "County-2 Rate",
                    yField: 'Rate2',
                    fill: true,
                    smooth: true,
                    style: {
                        color: 0xFF0000,
                        alpha: 0,
                        fillColor: 0xFF0000,
                        fillAlpha: 1,
                        'stroke-width': 0.2
                    }
                }]
        }
    });

    var winCorelate = new Ext.Window({
        iconCls: 'info',
        width: 800,
        height: 600,
        //hidden: true,
        maximizable: true,
        title: 'Unemployment Rate Correlation Between Counties - Ohio',
        autoShow: false,
        closeAction: 'hide',
        layout: 'fit',
        items: {
            xtype: 'linechart',
            store: chartStore,
            url: 'ext-3.4.1/resources/charts.swf',
            xField: 'Rate1',
            //yField: 'Rate2',    
            extraStyle: {
                animationEnabled: true,
                yAxis: {
                    titleRotation: -90
                },
                minorTicks: {
                    display: "none"
                },
                majorTicks: {
                    display: "outside",
                    size: 1,
                    color: 0x000000,
                    length: 3
                }
            },
            xAxis: new Ext.chart.NumericAxis({
                displayName: 'Unemployment Rate- County-1',
                title: 'Unemployment Rate- County-1',
                labelRenderer: Ext.util.Format.numberRenderer('0,0'),
                majorUnit: 1,
                minorUnit: 0.5
            }),
            yAxis: new Ext.chart.NumericAxis({
                displayName: 'Unemployment Rate- County-2',
                title: 'Unemployment Rate- County-2',
                labelRenderer: Ext.util.Format.numberRenderer('0,0'),
                majorUnit: 1,
                minorUnit: 0.5
            }),
            tipRenderer: function(chart, record, index, series) {
                return "Rate1: " + Ext.util.Format.number(record.data.Rate1, '0,0.00') + '%, Rate2: ' + Ext.util.Format.number(record.data.Rate2, '0,0.00') + "%";
                /*if (series.yField == 'Rate1') {
                 return Ext.util.Format.number(record.data.Rate1, '0,0') + '% unemployment for ' + Ext.util.Format.date(record.data.DateTaken, 'Y M');
                 } else {
                 return Ext.util.Format.number(record.data.Rate2, '0,0') + '% unemployment for ' + Ext.util.Format.date(record.data.DateTaken, 'Y M');
                 }*/
            },
            series: [{
                    //type: 'line',
                    displayName: "Correlation",
                    yField: 'Rate2',
                    //fill: true,
                    smooth: true,
                    style: {
                        color: 0x66CCFF,
                        alpha: 1,
                        fillColor: 0x0066FF,
                        fillAlpha: 1,
                        lineAlpha: 0.0
                    }
                },{
                    type: 'line',
                    displayName: "Regression",
                    yField: 'RegY',
                    fill: true,
                    smooth: true,
                    style: {
                        color: 0xFF0000,
                        alpha: 0,
                        fillColor: 0xFF0000,
                        fillAlpha: 1,
                        'stroke-width': 0.5
                    }
                }]
        }
    });
    
    var winKalman = new Ext.Window({
        iconCls: 'info',
        width: 800,
        height: 600,
        //hidden: true,
        maximizable: true,
        title: 'Kalman Filter Applied Unemployment Rates - Ohio',
        autoShow: false,
        closeAction: 'hide',
        layout: 'fit',
        items: {
            xtype: 'linechart',
            store: kalmanChartStore,
            url: 'ext-3.4.1/resources/charts.swf',
            xField: 'DateTaken',
            yField: 'KRate1',
            chartStyle: {
                animationEnabled: true,
                font: {
                    name: 'Tahoma',
                    color: 0x444444,
                    size: 11
                },
                dataTip: {
                    padding: 5,
                    border: {
                        color: 0x99bbe8,
                        size: 1
                    },
                    background: {
                        color: 0xDAE7F6,
                        alpha: .9
                    },
                    font: {
                        name: 'Tahoma',
                        color: 0x15428B,
                        size: 10,
                        bold: true
                    }
                },
                xAxis: {
                    majorGridLines: {size: 0, color: 0xeeeeee}
                },
                yAxis: {
                    majorGridLines: {size: 0, color: 0xeeeeee}
                }
            },
            extraStyle: {
                animationEnabled: true,
                legend: {
                    display: 'bottom',
                    padding: 0,
                    font: {
                        family: 'Tahoma',
                        size: 13
                    }
                },
                xAxis: {
                    labelRotation: -90
                },
                yAxis: {
                    titleRotation: -90
                },
                minorTicks: {
                    display: "none"
                },
                majorTicks: {
                    display: "outside",
                    size: 1,
                    color: 0x000000,
                    length: 3
                }
            },
            yAxis: new Ext.chart.NumericAxis({
                displayName: 'K.F. Unemployment Rate',
                title: 'K.F. Unemployment Rate',
                labelRenderer: Ext.util.Format.numberRenderer('0,0'),
                majorUnit: 1,
                minorUnit: 0.5
            }),
            xAxis: new Ext.chart.CategoryAxis({
                displayName: 'Year',
                title: 'Year',
                labelRenderer: Ext.util.Format.dateRenderer('Y'),
                calculateCategoryCount: true
            }),
            tipRenderer: function(chart, record, index, series) {
                if (series.yField == 'KRate1') {
                    return Ext.util.Format.number(record.data.KRate1, '0,0.00') + '% unemployment for ' + Ext.util.Format.date(record.data.DateTaken, 'Y M');
                } else if (series.yField == 'KRate2') {
                    return Ext.util.Format.number(record.data.KRate2, '0,0.00') + '% unemployment for ' + Ext.util.Format.date(record.data.DateTaken, 'Y M');
                } else {
                    return Ext.util.Format.number(record.data.KRateDiff, '0,0.00') + '% unemp. diff. for ' + Ext.util.Format.date(record.data.DateTaken, 'Y M');
                }
            },
            series: [{
                    type: 'line',
                    displayName: "County-1 Rate",
                    yField: 'KRate1',
                    fill: true,
                    smooth: true,  
                    style: {
                        color: 0x3399FF,
                        alpha: 0,
                        fillColor: 0x3399FF,
                        fillAlpha: 1,
                        'stroke-width': 0.2
                    }
                },
                {
                    type: 'line',
                    displayName: "County-2 Rate",
                    yField: 'KRate2',
                    fill: true,
                    smooth: true,
                    style: {
                        color: 0x99CCFF,
                        alpha: 0,
                        fillColor: 0x99CCFF,
                        fillAlpha: 1,
                        'stroke-width': 0.2
                    }
                },
                {
                    type: 'line',
                    displayName: "Difference",
                    yField: 'KRateDiff',
                    fill: true,
                    smooth: true,
                    style: {
                        color: 0xFF0000,
                        alpha: 0,
                        fillColor: 0xFF0000,
                        fillAlpha: 1,
                        'stroke-width': 0.2
                    }
                }]
        }
    });
});