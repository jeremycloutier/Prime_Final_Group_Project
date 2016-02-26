/**
 * Created by jeremycloutier on 2/16/16.
 */

var app = angular.module('myApp', ['ngRoute']);

app.controller('MainController', [ '$scope', '$location', 'SmartSheetService', function($scope, $location, SmartSheetService){

    $scope.endDate = new Date();
    //sets default start date to 05-07-2012
    $scope.startDate = new Date('2012-05-08');

    $scope.smartSheetData = [];
    //function on page load to do the call to get all the Smartsheet data
    //returns an array of objects with the columns we need
    SmartSheetService.getSmartSheetData().then(function(response){
        $scope.smartSheetData = response.data;
        $scope.submitDate();
    });

    $scope.genLineGraph = genLineGraph;
    //function that kicks off after date range is selected
    $scope.submitDate = function(){
        $scope.numServed = 0;
        $scope.completed = { number: 0, percent: 0 };
        $scope.certified = { number: 0, percent: 0 };
        $scope.placed = { number: 0, percent: 0 };
        $scope.certNetwork = { number: 0, percent: 0 };
        $scope.certServer = { number: 0, percent: 0 };
        $scope.certSecurity = { number: 0, percent: 0 };
        //set the default for the salary calculator checkboxes
       //resets them to unchecked if the date range is changed
       $scope.networkPlus = false;
       $scope.securityPlus = false;
       $scope.serverPlus = false;
       $scope.otherCert = false;
       $scope.calculatedSalary = {};


        for(var i=0; i<$scope.smartSheetData.length; i++){
            var tempStartDate = new Date($scope.smartSheetData[i].classStart);
            // console.log("object number" + i + " " + $scope.smartSheetData[i]);

            //inelegant way to account for new Date() reading date as one day prior
            //add a day to the result
            var classStart = tempStartDate.setDate(tempStartDate.getDate() + 1);
            //check classStart is in the date range selected
            if(classStart >= $scope.startDate && classStart <= $scope.endDate){
                //count total number served
                $scope.numServed++;
                $scope.completed = incrementRowVals($scope.smartSheetData[i].gradDate, $scope.completed);
                $scope.certified = incrementRowVals($scope.smartSheetData[i].certDate, $scope.certified);
                $scope.placed = incrementRowVals($scope.smartSheetData[i].employHistory.start, $scope.placed);
                $scope.certNetwork = incrementRowVals($scope.smartSheetData[i].networkPlus, $scope.certNetwork);
                $scope.certServer = incrementRowVals($scope.smartSheetData[i].serverPlus, $scope.certServer);
                $scope.certSecurity = incrementRowVals($scope.smartSheetData[i].securityPlus, $scope.certSecurity);
            }
        }
        //Set Percentages
        $scope.completed = calcPercent($scope.completed);
        $scope.certified = calcPercent($scope.certified);
        $scope.placed = calcPercent($scope.placed);
        $scope.certNetwork = calcPercent($scope.certNetwork);
        $scope.certServer = calcPercent($scope.certServer);
        $scope.certSecurity = calcPercent($scope.certSecurity);

        var adjStartDate = new Date($scope.startDate);
        adjStartDate.setDate(adjStartDate.getDate() - 1);
        $scope.avgWageAtPlacement = computeAveragePlacedWage($scope.smartSheetData, adjStartDate, Date.parse($scope.endDate));
        $scope.avgCurrentWage =  computeAverageCurrentWage($scope.smartSheetData, adjStartDate, Date.parse($scope.endDate));
        $scope.getTopFive = getTopFiveEmployers($scope.smartSheetData, adjStartDate, Date.parse($scope.endDate));
        $scope.retentionData = allEmployedAtMilestones($scope.smartSheetData, adjStartDate, Date.parse($scope.endDate));
    };



    function employedAtMilestones(rowData, startDate, endDate, milestoneDays){
        var milestoneHistory = { };
        //how to check against start/end date?  Need to say "no data available" or "-" if not enough time has elapsed to calculate?
        var classStart = Date.parse(rowData.classStart);
        if (isNaN(classStart) || isNaN(startDate) || isNaN(endDate)) return null;
        if (classStart > endDate || classStart < startDate) return null;
        var daysEmployed = 0; /*convention: 0 means never employed, -1 means employed through present,
         positive integer means employed for that number of days*/
        var daysSincePlaced = 0; //we can't judge employment for a milestone that hasn't occurred yet (in time).
        var startWork = Date.parse(rowData.employHistory.start);
        var endWork = Date.parse(rowData.employHistory.end);

        if (startWork && !isNaN(startWork)){
            daysSincePlaced = ((new Date() - startWork) / 1000 / 3600 / 24).toFixed(0);
            if (endWork && !isNaN(endWork)){
                daysEmployed = (endWork - startWork) / 1000 / 3600 / 24;
            }
            else {
                daysEmployed = -1; //using this value to represent continuous employment through present
            }
        }

        var keys = Object.keys(milestoneDays);
        for (var i = 0; i < keys.length; i++){
            if (daysSincePlaced < milestoneDays[keys[i]]) break;
            if (daysEmployed < 0 || daysEmployed >= milestoneDays[keys[i]]){
                milestoneHistory[keys[i]] = true;
            }
            else {
              for (var j = i; j < keys.length; j++){
                if (daysSincePlaced < milestoneDays[keys[j]]) break;
                milestoneHistory[keys[j]] = false;
              }
              break;
            }
        }
        return milestoneHistory;
    }


    function allEmployedAtMilestones(allRows, startDate, endDate){
        var milestoneDays = { 'threeMonth': 90,  'sixMonth': 180, 'oneYear': 365, 'twoYear': 730, 'threeYear': 1095, 'fourYear': 1460, 'fiveYear': 1825 };
        var allKeys = Object.keys(milestoneDays);
        var milestoneRetentionRates = {};
        var studentCount = {};
        for (var i = 0; i < allKeys.length; i++){
            milestoneRetentionRates[allKeys[i]] = { numRetained: 0, fraction: null, percent: null };
            studentCount[allKeys[i]] = 0;
        }
        var milestoneData = {};
        var keys = {};
        for (i = 0; i < allRows.length; i++){
            milestoneData = employedAtMilestones(allRows[i], startDate, endDate, milestoneDays);
            if (!milestoneData) continue;
            keys = Object.keys(milestoneData);
            for (var j = 0; j < keys.length; j++){
                if (milestoneData[keys[j]]) milestoneRetentionRates[keys[j]].numRetained++;
                studentCount[keys[j]]++;
            }
        }
        for (i = 0; i < allKeys.length; i++){
            if (studentCount[allKeys[i]] <= 0) {
              milestoneRetentionRates[allKeys[i]].fraction = "N/A";
              milestoneRetentionRates[allKeys[i]].percent = "N/A";
            }
            else {
              milestoneRetentionRates[allKeys[i]].fraction = milestoneRetentionRates[allKeys[i]].numRetained + " / " + studentCount[allKeys[i]];
              milestoneRetentionRates[allKeys[i]].percent = (milestoneRetentionRates[allKeys[i]].numRetained / studentCount[allKeys[i]] * 100).toFixed(1) + "%";
            }
        }
        return milestoneRetentionRates;
    }


    //[[AVERAGE WAGE AT PLACEMENT]]///////
    function computeAveragePlacedWage(allRows, startDate, endDate){
        var sumOfWages = 0;
        var numPlaced = 0;
        var tempWage = 0;

        for (var i = 0; i < allRows.length; i++){
            tempWage = getWageAtPlacement(allRows[i], startDate, endDate);
            if (tempWage){
                sumOfWages += tempWage;
                numPlaced++;
            }
        }
        return (sumOfWages / numPlaced).toFixed(2);
    }


    function getWageAtPlacement(rowData, startDate, endDate){
        var classStart = Date.parse(rowData.classStart);
        if (isNaN(classStart) || isNaN(startDate) || isNaN(endDate)) return null;
        if (rowData.employHistory.start){
            if (startDate <= classStart && classStart <= endDate && rowData.wages.length > 0) return rowData.wages[0];
        }
        return null;
    }



    //[[AVERAGE CURRENT WAGE ]]///CURRENT //CURRENT //CURRENT //CURRENT //CURRENT //
    function computeAverageCurrentWage(allRows, startDate, endDate){
        var sumOfWages = 0;
        var numEmployed = 0;
        var tempWage = 0;

        for (var i = 0; i < allRows.length; i++){
            tempWage = getCurrentWage(allRows[i], startDate, endDate);
            if (tempWage){
                sumOfWages += tempWage;
                numEmployed++;
            }
        }
        return (sumOfWages / numEmployed).toFixed(2);
    }


    function getCurrentWage(rowData, startDate, endDate){
        var classStart = Date.parse(rowData.classStart);
        if (isNaN(classStart) || isNaN(startDate) || isNaN(endDate)) return null;
        if (rowData.employHistory.start && !rowData.employHistory.end){
            if (startDate <= classStart && classStart <= endDate && rowData.wages.length > 0) return rowData.wages[rowData.wages.length -1];
        }
        return null;
    }

//[][][][] Average Salary Calculator [][][][][][][]
$scope.calcAvgSalary = function(){
    //array to hold checkboxes selected
    $scope.tempCertArray = [];
    //push checkbox names to array. checkbox names set to match column names
    if ($scope.networkPlus){$scope.tempCertArray.push("networkPlus");}
    if ($scope.serverPlus){$scope.tempCertArray.push("serverPlus");}
    if ($scope.securityPlus){$scope.tempCertArray.push("securityPlus");}
    if ($scope.otherCert){$scope.tempCertArray.push("otherCert");}

    // $scope.getAverageSalary = getAvgSalary($scope.tempCertArry, $scope.smartSheetData, adjStartDate, Date.parse($scope.endDate));
    var adjStartDate = new Date($scope.startDate);
    adjStartDate.setDate(adjStartDate.getDate() - 1);
    $scope.calculatedSalary = getAvgSalary($scope.tempCertArray, $scope.smartSheetData, adjStartDate, Date.parse($scope.endDate));
};

function getAvgSalary(tempCert, allRows, startDate, endDate){
    var sumOfWages = 0;
    var tempWage = 0;
    var count = 0;
    var tempCalculatedSalary = {};

    if (isNaN(startDate) || isNaN(endDate)) return null;

    for (var i = 0; i < allRows.length;i++){
        var classStart = Date.parse(allRows[i].classStart);
        if (isNaN(classStart)) continue;
        //check to stay within time range selected
        if (startDate <= classStart && classStart <= endDate){
            for(var j=0; j< tempCert.length; j++){
              var cert = tempCert[j];
              //check that each checkbox selected is not null on smartsheet
              if(!allRows[i][cert]) break;
              //if we've reached the last checkbox in array
              if(j== tempCert.length-1){
                tempWage = getCurrentWage(allRows[i], startDate, endDate);
                if (tempWage){
                    sumOfWages += tempWage;
                    count++;
                }
              }
            }
        }
    }
    tempCalculatedSalary.avgWage = (sumOfWages/count).toFixed(2);
    tempCalculatedSalary.count = count;

    return (tempCalculatedSalary);
}

//Top Five Employers
    function getTopFiveEmployers (allRows, startDate, endDate){
        if (isNaN(startDate) || isNaN(endDate)) return null;
        var employers = {};
        $scope.topFive = [];

        for (var i = 0; i < allRows.length;i++){
            var classStart = Date.parse(allRows[i].classStart);
            if (isNaN(classStart)) continue;
            if (startDate <= classStart && classStart <= endDate){
                for (var j = 0; j< allRows[i].distinctEmployers.length; j++){
                    var tempString = allRows[i].distinctEmployers[j];
                    if (!employers.hasOwnProperty(tempString)){
                        employers[tempString] = 0;
                    }
                    employers[tempString]++;
                }
            }

        }

        $scope.sortedEmployers = sortObject(employers);

        for (var n = 0; n < 5; n++){
            $scope.topFive.push($scope.sortedEmployers.pop());
        }
        return $scope.topFive;
    }

    //PIE CHART
    (function(d3) {
        'use strict';
        var dataset = [
            //{ label: 'Abulia', count: 25 },
            //{ label: 'Betelgeuse', count: 25 },
            { label: 'White', count: 15 },
            { label: 'Black', count: 10 },
            {label:'Latino', count: 5},
            {label:'Asian', count: 8}
        ];
        var width = 360;
        var height = 360;
        var radius = Math.min(width, height) / 2;
        var color = d3.scale.ordinal()
            .range(['pink', 'blue', 'yellow', 'green']);
        //var color = d3.scale.category20b();
        var svg = d3.select('#chart')
            .append('svg')
            .attr('width', width)
            .attr('height', height)
            .append('g')
            .attr('transform', 'translate(' + (width / 2) +
                ',' + (height / 2) + ')');
        var arc = d3.svg.arc()
            .outerRadius(radius);
        var pie = d3.layout.pie()
            .value(function(d) { return d.count; })
            .sort(null);
        var path = svg.selectAll('path')
            .data(pie(dataset))
            .enter()
            .append('path')
            .attr('d', arc)
            .attr('fill', function(d, i) {
                return color(d.data.label);
            });
    })(window.d3);

    //Generate Pie Chart function
    $scope.generatePieCharts = function(){
        var adjStartDate = new Date($scope.startDate);
        adjStartDate.setDate(adjStartDate.getDate() - 1);

        console.log('demographic, progress', $scope.selectedDemographic, $scope.selectedProgress);
        // Get all that data, yo

        //var allRows=$scope.smartSheetData;
        var rowsInPie;

        if ($scope.selectedProgress == 'Served'){
            //    Get all served
            console.log('get all data')
            rowsInPie=getServedInDateRange($scope.smartSheetData, adjStartDate, Date.parse($scope.endDate));

        } else if($scope.selectedProgress=='Completed') {
            //    Get completed
            console.log('get completed')
            rowsInPie = getCompleted($scope.smartSheetData, adjStartDate, Date.parse($scope.endDate));

        }else if($scope.selectedProgress='Certified A+') {
            //    get Certified A+
            console.log('get certified A+ data')
            rowsInPie = getCertifiedAPlus($scope.smartSheetData, adjStartDate, Date.parse($scope.endDate));

        }else if($scope.selectedProgress='Placed'){
            //    get Placed
            console.log('get Placed data')
            rowsInPie = getPlaced($scope.smartSheetData, adjStartDate, Date.parse($scope.endDate))
        }


        if ($scope.selectedDemographic == 'Race'){
            //    Get Race Data
            slicePieByRace(rowsInPie);


        } else if ($scope.selectedDemographic=='Gender') {
            //    Get Gender Data
            console.log('slicing by gender')
            slicePieByGender(rowsInPie);

        } else if ($scope.selectedDemographic =='Veteran Status'){
            //    Get Veteran Status Data
            slicePieByVeteran(rowsInPie);
            console.log('Get veteran status data')
        }

    };


    function incrementRowVals(smartsheetDataVal, numPercentObject){
      var tempObj = numPercentObject;
      if (smartsheetDataVal){
          tempObj.number++;
      }
      return tempObj;
    }

    function calcPercent(numPercentObject){
      var tempObj = numPercentObject;
      if (tempObj.number){
        tempObj.percent = Number(Math.round(((tempObj.number / $scope.numServed)*100) + 'e2') + 'e-2');
      }
      return tempObj;
    }

    function sortObject(obj) {
        var arr = [];
        var prop;
        for (prop in obj) {
            if (obj.hasOwnProperty(prop)) {
                arr.push({
                    'key': prop,
                    'value': obj[prop]
                });
            }
        }
        arr.sort(function(a, b) {
            return a.value - b.value;
        });
        return arr; // returns array
    }

    $scope.demographicList = ['Gender', 'Age', 'Race', 'Veteran Status']; // More here, possibly?
    $scope.progressList = ['Served', 'Completed', 'Certified A+', 'Placed'];
    $scope.selectedDemographic = 'Gender';
    $scope.selectedProgress = 'Served';
    $scope.tab = 'a';
    $scope.chartTab = 'pie';
    $scope.averageShow = false;

    $scope.generateCharts = function(demographics, progress){
        console.log('demographics, progress', demographics, progress);
    };

    $scope.showAverageSalary = function(){
        $scope.averageShow = true;
    };

    $scope.hideAverageSalary = function (){
        $scope.averageShow = false;
    };

}]);


// functions for our pie chart maker

function getServedInDateRange(allRows, startDate, endDate){
    if (isNaN(startDate) || isNaN(endDate)) return null;

    var servedInRange = [];
    for (var i = 0; i < allRows.length;i++){
        var classStart = Date.parse(allRows[i].classStart);
        if (isNaN(classStart)) continue;

        if(startDate <= classStart && classStart <= endDate){
            servedInRange.push(allRows[i]);
        }
    }
    //rowsInPie = completed;
    console.log('served in date range', servedInRange)
    return servedInRange;

}
function getCompleted(allRows, startDate, endDate){
    if (isNaN(startDate) || isNaN(endDate)) return null;

    var completed = [];
    for (var i = 0; i < allRows.length;i++){
        var classStart = Date.parse(allRows[i].classStart);
        if (isNaN(classStart)) continue;

        if(allRows[i].gradDate && startDate <= classStart && classStart <= endDate){
            completed.push(allRows[i]);
        }
    }
    //rowsInPie = completed;
    console.log('completed: ', completed)
    return completed;

}

function getCertifiedAPlus(allRows, startDate, endDate){
    if (isNaN(startDate) || isNaN(endDate)) return null;

    var certified = [];
    for (var i = 0; i < allRows.length;i++){
        var classStart = Date.parse(allRows[i].classStart);
        if (isNaN(classStart)) continue;

        if(allRows[i].certDate && startDate <= classStart && classStart <= endDate){
            certified.push(allRows[i])
        }
    }
    //rowsInPie = certified;
    console.log('certified A+ rows in pie', certified)
    return certified;
}

function getPlaced( allRows, startDate, endDate){
    if (isNaN(startDate) || isNaN(endDate)) return null;

    var placed = [];
    for (var i = 0; i < allRows.length;i++){
        var classStart = Date.parse(allRows[i].classStart);
        if (isNaN(classStart)) continue;

        if(allRows[i].placedFullTime && startDate <= classStart && classStart <= endDate){
            placed.push(allRows[i]);
        }
    }
    //rowsInPie = placed;
    console.log('placed rows in pie', placed)
}

function slicePieByRace(rows){
    var numberOfBlacks=0;
    var numberOfWhites=0;
    var numberOfLatinos=0;
    var numberOfAsians =0;
    var numberOfOthers=0;

    for (var i = 0; i < rows.length;i++){
        var ethnicity = rows[i].ethnicity;
        if (ethnicity=="Black / African American"){
            numberOfBlacks++;
        }else if(ethnicity=="White"){
            numberOfWhites++;
        }else if(ethnicity=="Hispanic / Latino"){
            numberOfLatinos++
        }else if(ethnicity=="Other, Multi-Racial"){
            numberOfOthers++;
        }else if(ethnicity=="Asian"){
            numberOfAsians++;
        }
    };
    var dataset = [
        {label:'Black', count:numberOfBlacks},
        {label:'White', count:numberOfWhites},
        {label:'Latino', count:numberOfLatinos},
        {label:'Asian', count:numberOfAsians},
        {label:'Other', count:numberOfOthers}
    ]

    console.log('dataset', dataset);
}

function slicePieByGender(rows){
    var numberOfMales = 0;
    var numberOfFemales=0;

    for (var i = 0; i < rows.length;i++){
        var female = rows[i].female;
        if (female){
            numberOfFemales++
        } else {
            numberOfMales++;
        }
    }
    var dataset =[ {label:'Male', count:numberOfMales},
        {label:'Female', count:numberOfFemales}
    ]
    console.log('dataset', dataset);
}

function slicePieByVeteran(rows){
    var numberOfVeterans = 0;
    var numberOfNonVeterans = 0;

    for (var i = 0; i < rows.length;i++){
        if (rows[i].veteran){
            numberOfVeterans++;
        } else {
            numberOfNonVeterans++;
        }
    }

    var dataset = [{label:'Veteran', count:numberOfVeterans},
        {label:'Non-veterans', count:numberOfNonVeterans}]

    console.log('dataset', dataset);
}
// D3 LINE GRAPHS
function genLineData(){
  var fakeData = [
      [
          { x: new Date(2012, 1, 1), y: 2},
          { x: new Date(2012, 3, 1), y: 4},
          { x: new Date(2012, 5, 1), y: 6}

      ],
      [
          { x: new Date(2012, 2, 1), y: 10},
          { x: new Date(2012, 4, 1), y: 8},
          { x: new Date(2012, 6, 1), y: 6}
      ]
  ];
    return fakeData;
}

function genLineGraph(){
    console.log('yo, line chart');
    var gWidth = 750;
    var gHeight = 500;
    var pad = 60;
    var gData = genLineData();
    var palette = d3.scale.category10();

    var yRange = d3.extent(d3.merge(gData), function(axisData){ return axisData.y; });
    //var xRange = d3.extent(d3.merge(gData), function(axisData){ return axisData.x; });
    var xScale = d3.time.scale()
        .domain([new Date(2012, 0, 1), new Date(2012, 11, 31)])
        .range([pad, gWidth - pad * 2]);

    var xAxis = d3.svg.axis()
        .scale(xScale)
        .orient("bottom")
        .ticks(d3.time.months)
        .tickSize(16, 0)
        .tickFormat(d3.time.format("%b"));

    var yScale = d3.scale.linear()
        .domain([yRange[0], yRange[1]])
        .range([gHeight - pad, pad]);

    d3.select("svg").remove(); //clear chart for rebuild

    var svg = d3.select('.lineControls')
        .append("svg")
        .attr("width", gWidth)
        .attr("height", gHeight)
        .attr("opacity", "1");

    var yAxis = d3.svg.axis().scale(yScale).orient("left").ticks(8);

    svg.append("g").attr("class", "axis")
        .attr("transform", "translate(0," + (gHeight - pad) + ")").call(xAxis);

    svg.append("g").attr("class", "axis")
        .attr("transform", "translate(" + pad + ",0)").call(yAxis);

    var linePath = svg.selectAll("g.line").data(gData);

    linePath.enter().append("g")
        .attr("class", "line").attr("style", function(d) {
        return "stroke: " + palette(gData.indexOf(d));
    });

    linePath.selectAll("path").data(function (d) { return [d]; })
        .enter().append('path').attr("d", d3.svg.line()
        .x(function (d) { return xScale(d.x); })
        .y(function (d) { return yScale(d.y); })
    );

}



//[][][] Factory to get Smartsheet data [][][][[[[[]]]]]
app.factory('SmartSheetService', ['$http', function($http){

    var getSmartSheetData = function(){
        return $http.get('/api');
    };

    return {
        getSmartSheetData: getSmartSheetData,
    };
}]);
