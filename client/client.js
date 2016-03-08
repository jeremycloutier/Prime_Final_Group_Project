/**
 * Created by jeremycloutier on 2/16/16.
 */
var app = angular.module('myApp', ['ngRoute']);

//***CONSTANT DECLARATIONS***
var CALC_ASSIST = 'calcAssist';
//***Demographics: Category / Dropdown Names***
var GENDER_CAT = 'Gender';
var AGE_CAT = 'Age';
var RACE_CAT = 'Race/Ethnicity';
var VET_CAT = 'Veteran Status';
var WAGE_CAT = 'Wage at Placement';
var PLACE_CAT = 'Placement Rates';
var GRAD_CAT = 'Graduation Rates';
//***Program Progress: Category / Dropdown Names***
var SERVED_CAT = 'Served';
var COMPLETED_CAT = 'Completed';
var CERT_CAT = 'Certified A+';
var PLACED_CAT = 'Placed';
//***Series Names / Bins***
//Gender
var FEMALE = 'Female';
var MALE = 'Male';
//Age
var UNDER_18 = 'Under 18';
var EIGHTEEN_TO_24 = '18 to 24';
var TWENTY_FOUR_TO_30 = '24 to 30';
var THIRTY_TO_FORTY = '30 to 40';
var FORTY_TO_FIFTY = '40 to 50';
var OVER_FIFTY = 'Over 50';
//Veteran Status
var VETERAN = 'Veteran';
var NON_VETERAN = 'Non-Veteran';

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
        $scope.generatePieCharts();
        $scope.genLineGraph($scope.smartSheetData, $scope.selectedLineGraph, Date.parse($scope.startDate), Date.parse($scope.endDate));
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
    //check if no checkboxes are selected
    if (tempCert && tempCert.length == 0){
      tempCalculatedSalary.avgWage = 0;
      tempCalculatedSalary.count = 0;
      //if at least one checkbox is selected
    } else {
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
    if (count == 0){
      tempCalculatedSalary.avgWage = 0;
      tempCalculatedSalary.count = count;
    }else {
    tempCalculatedSalary.avgWage = (sumOfWages/count).toFixed(2);
    tempCalculatedSalary.count = count;
    }
  }
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


    $scope.generatePieWages = function(pieData){
      var storage = [];
      var adjStartDate = new Date($scope.startDate);
      adjStartDate.setDate(adjStartDate.getDate() - 1);

      for (var i = 0; i < pieData.length; i++){
         storage.push({'name': pieData[i].label,
         'sumWages': 0, 'countWages': 0, 'averageWage': 0});
      }

      for (var j = 0; j < $scope.smartSheetData.length; j++){
        var row = $scope.smartSheetData[j];
        var wage = getWageAtPlacement(row, adjStartDate, Date.parse($scope.endDate));
        var seriesData = graphSeriesData(row, $scope.selectedDemographic, adjStartDate, Date.parse($scope.endDate));
        if (wage && seriesData){
          var series = seriesData.seriesName;
          if ($scope.selectedDemographic == VET_CAT){
            if (series == CALC_ASSIST) series = NON_VETERAN; //special case
          }
          for (var k = 0; k < storage.length; k++){
            if (series == storage[k].name){
              storage[k].countWages++;
              storage[k].sumWages += wage;
            }
          }
        }
      }
      var results = [];
      for (var k = 0; k < storage.length; k++){
        if (storage[k].countWages > 0){
          storage[k].averageWage = (storage[k].sumWages / storage[k].countWages).toFixed(2);
          results.push(storage[k]);
        }
      }
      return results;
    }

    //Generate Pie Chart function
    $scope.generatePieCharts = function () {

        d3.select("svg").remove();
        d3.select(".tooltips").remove();
        d3.select("#pieLegend").remove(); //clear legend

        var adjStartDate = new Date($scope.startDate);
        adjStartDate.setDate(adjStartDate.getDate() - 1);

        //for chart heading display
        $scope.selectedDisplay = $scope.selectedProgress;

        var rowsInPie = [];
        var dataset = [];
        $scope.pieHeading = "";

        //get the data depending on drop down selection ("Served", "Completed", "Certified A+", "Placed")
        rowsInPie = getRange($scope.smartSheetData, adjStartDate, Date.parse($scope.endDate), $scope.selectedProgress);

        //SLICE PIE BY SELECTED DEMOGRAPHIC - RACE, GENDER, VETERAN
        if ($scope.selectedDemographic == RACE_CAT) {
            //    Get Race Data
            dataset = slicePieByRace(rowsInPie, adjStartDate, Date.parse($scope.endDate));
            $scope.pieHeading = RACE_CAT;
        } else if ($scope.selectedDemographic==AGE_CAT){
            dataset = slicePieByAge(rowsInPie);
            $scope.pieHeading = AGE_CAT;
        } else if ($scope.selectedDemographic == GENDER_CAT) {
            //    Get Gender Data
            dataset = slicePieByGender(rowsInPie);
            $scope.pieHeading = GENDER_CAT;
        } else if ($scope.selectedDemographic == VET_CAT) {
            //    Get Veteran Status Data
            dataset = slicePieByVeteran(rowsInPie);
            $scope.pieHeading = VET_CAT;
        }

        $scope.pieTitle = 'Number ' + $scope.selectedDisplay + ' by ' + $scope.pieHeading;

        $scope.pieWageInfo = $scope.generatePieWages(dataset);

        $scope.dataset = dataset;
        var width = 650;
        var height = 400;

        var radius = Math.min(width, height) / 2;
        var legendRectSize = 15;

        var color = d3.scale.category10();
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
            .value(function (d) {
                return d.count;
            })
            .sort(null);

        var legendpop = d3.select('.tooltipBox')
            .append('div')
            .attr('class', 'tooltips');

        legendpop.append('div')
            .attr('class', 'label');

        legendpop.append('div')
            .attr('class', 'count');

        legendpop.append('div')
            .attr('class', 'percent');

        dataset.forEach(function (d) {
            d.count = +d.count;
            d.enabled = true; // NEW
            legendpop.select('.label').html("Mouse over");
            legendpop.select('.count').html("chart to");
            legendpop.select('.percent').html('view percents');
            //legendpop.select('.tooltips').style('display', 'block');
        });

        var path = svg.selectAll('path')
            .data(pie(dataset))
            .enter()
            .append('path')
            .attr('d', arc)
            .attr('fill', function (d, i) {
                return color(d.data.label);
            }) // UPDATED (removed semicolon)
            .each(function (d) {
                this._current = d;
            }); // NEW

        path.on('mouseover', function (d) {
            var total = d3.sum(dataset.map(function (d) {
                return (d.enabled) ? d.count : 0; // UPDATED
            }));
            var percent = Math.round(1000 * d.data.count / total) / 10;
            legendpop.select('.label').html(d.data.label);
            legendpop.select('.count').html(d.data.count);
            legendpop.select('.percent').html(percent + '%');
            legendpop.select('.tooltips').style('text-align', 'center');
        });

        path.on('mouseout', function () {
            legendpop.style('display', 'none');
        });

        var svgLegend = d3.select('#pieControlPanel')
            .append('svg')
            .attr('id', 'pieLegend')
            .append('g');

        var legend = svgLegend.selectAll('.legend')
            .data(color.domain())
            .enter()
            .append('g')
            .attr('class', 'legend');

        legend.append('rect')
            .attr("x", 0)
            .attr("y", function(d, i){ return i * 24; })
            .attr('width', legendRectSize)
            .attr('height', legendRectSize)
            .style('fill', color);

        legend.append('text')
            .attr("x", 20)
            .attr("y", function(d, i){ return i *  24 + 11; })
            .text(function (d) {
                return d;
            });
    }
    //end of generatePieCharts function

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

    $scope.demographicList = [GENDER_CAT, AGE_CAT, RACE_CAT, VET_CAT]; // More here, possibly?
    $scope.progressList = [SERVED_CAT, COMPLETED_CAT, CERT_CAT, PLACED_CAT];
    $scope.lineGraphList = [GENDER_CAT, AGE_CAT, RACE_CAT, VET_CAT, WAGE_CAT,PLACE_CAT, GRAD_CAT];

    $scope.selectedDemographic = GENDER_CAT;
    $scope.selectedProgress = SERVED_CAT;
    $scope.selectedLineGraph = GENDER_CAT;

    $scope.tab = 'a';
    $scope.chartTab = 'pie';
    $scope.averageShow = false;

    $scope.showAverageSalary = function(){
        $scope.averageShow = true;
    };

    $scope.hideAverageSalary = function (){
        $scope.averageShow = false;
    };

}]);





// functions for our pie chart maker
function getRange(allRows, startDate, endDate, selected){
    if (isNaN(startDate) || isNaN(endDate)) return null;

    var range = [];
    if(selected == SERVED_CAT){
      for (var i = 0; i < allRows.length;i++){
          var classStart = Date.parse(allRows[i].classStart);
          if (isNaN(classStart)) continue;

          if(startDate <= classStart && classStart <= endDate){
            range.push(allRows[i]);
          }
        } return range;
      } else if (selected == COMPLETED_CAT){
        for (var i = 0; i < allRows.length;i++){
            var classStart = Date.parse(allRows[i].classStart);
            if (isNaN(classStart)) continue;

            if(allRows[i].gradDate && startDate <= classStart && classStart <= endDate){
              range.push(allRows[i]);
            }
          } return range;
      } else if (selected == CERT_CAT) {
        for (var i = 0; i < allRows.length;i++){
            var classStart = Date.parse(allRows[i].classStart);
            if (isNaN(classStart)) continue;

            if(allRows[i].certDate && startDate <= classStart && classStart <= endDate){
              range.push(allRows[i]);
            }
          } return range;
      } else if (selected == PLACED_CAT){
        for (var i = 0; i < allRows.length;i++){
            var classStart = Date.parse(allRows[i].classStart);
            if (isNaN(classStart)) continue;

            if(allRows[i].placedFullTime && startDate <= classStart && classStart <= endDate){
              range.push(allRows[i]);
            }
          } return range;
      }
}
//Slice pie by selected demographic
function slicePieByAge(rows){
    var numUnder18 = 0;
    var num18to24 = 0;
    var num24to30 = 0;
    var num30to40 = 0;
    var num40to50 = 0;
    var numOver50 = 0;

    for (var i = 0; i < rows.length;i++){
        var age = rows[i].ageAtStart;

        if (age<18){
            numUnder18++;
        }else if (age<24) {
            num18to24++;
        } else if( age < 30){
            num24to30++;
        } else if (age < 40){
            num30to40++;
        } else if (age <50) {
            num40to50++;
        } else {
            numOver50++;
        }
    }

    return [
        {label: UNDER_18, count: numUnder18},
        {label: EIGHTEEN_TO_24, count: num18to24},
        {label: TWENTY_FOUR_TO_30, count: num24to30},
        {label: THIRTY_TO_FORTY, count: num30to40},
        {label: FORTY_TO_FIFTY, count: num40to50},
        {label: OVER_FIFTY, count: numOver50}
    ];
}

function slicePieByRace(rows, startDate, endDate){
    var countsByRace = [];
    for (var i = 0; i < rows.length; i++){
        var ethnicityData = graphSeriesData(rows[i], RACE_CAT, startDate, endDate)
        if (ethnicityData){
          var seriesName = ethnicityData.seriesName;
          if (seriesName){
            if (countsByRace.length == 0){
              countsByRace.push({ 'label': seriesName, 'count': 1 });
            }
            else {
              for (var j = 0; j < countsByRace.length; j++){
                if (countsByRace[j].label == seriesName){
                  countsByRace[j].count++;
                  break;
                }
                else {
                  if (j == countsByRace.length - 1){
                    countsByRace.push({ 'label': seriesName, 'count': 1 });
                    break;
                  }
                }
              }
            }
          }
        }
    }
    return countsByRace;
}

function slicePieByGender(rows){
    var numberOfMales = 0;
    var numberOfFemales=0;

    for (var i = 0; i < rows.length;i++){

        var female = rows[i].female;

        if (female){
            numberOfFemales++;
        } else {
            numberOfMales++;
        }
    };
    return [ {label:MALE, count:numberOfMales},
        {label:FEMALE, count:numberOfFemales}
    ];
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
    return [{label:VETERAN, count:numberOfVeterans},
        {label:NON_VETERAN, count:numberOfNonVeterans}];
}


// D3 LINE GRAPHS
/*Given the name of the field to be line-graphed: assembles the data for D3 to use.*/
function buildLineData(allRows, yFieldName, startDate, endDate){
    var dataPoint = null;
    var seriesNames = [];
    var seriesByClassStart = [];

    var countsByClass = [];
    var graphData = [];

    var chartType = 'percentage';
    //Special case: we will display the average wage by class start date...
    if (yFieldName == WAGE_CAT) chartType = 'average';

    //Assemble list of groupings (to become x-values) by class start date
    for (var iBin = 0; iBin < allRows.length; iBin++){
        if (!allRows[iBin].classStart) continue;
        if (countsByClass.length == 0) {
            countsByClass.push({ 'date': allRows[iBin].classStart, 'sum': 0 });
            continue;
        }
        for (var jBin = 0; jBin < countsByClass.length; jBin++){
            if (countsByClass[jBin].date == allRows[iBin].classStart) break;
            if (jBin >= countsByClass.length - 1){
                countsByClass.push({ 'date': allRows[iBin].classStart, 'sum': 0 });
            }
        }
    }
    //Sort the groupings from earliest to latest class
    countsByClass.sort(function(a, b){
        if (a.date < b.date) return -1;
        if (a.date > b.date) return 1;
        return 0;
    });

    for (var i = 0; i < allRows.length; i++){
        var seriesIndex = -1;
        var classIndex = -1;
        dataPoint = graphSeriesData(allRows[i], yFieldName, startDate, endDate);
        if (dataPoint){
            for (var j = 0; j < seriesNames.length; j++){
                if (seriesNames[j] == dataPoint.seriesName){
                    seriesIndex = j;
                    break;
                }
            }
            if (seriesIndex < 0){
                seriesIndex = seriesNames.length;
                seriesNames.push(dataPoint.seriesName);
                seriesByClassStart.push([]);
                for (var l = 0; l < countsByClass.length; l++){
                    seriesByClassStart[seriesByClassStart.length - 1].push({ 'date': countsByClass[l].date, 'sum': 0 });
                }
                graphData.push([]);
            }
            for (var k = 0; k < countsByClass.length; k++){
                if (Date.parse(countsByClass[k].date) == dataPoint.classStart){
                    countsByClass[k].sum++;
                    seriesByClassStart[seriesIndex][k].sum += dataPoint.dataVal;
                }
            }
        }
    }

    for (var s = 0; s < graphData.length; s++){
        for (var g = 0; g < seriesByClassStart[s].length; g++){
            var xVal = Date.parse(seriesByClassStart[s][g].date);
            var yVal = null;
            if (countsByClass[g] && countsByClass[g].sum > 0){
                if (chartType == 'percentage'){
                    yVal = seriesByClassStart[s][g].sum / countsByClass[g].sum * 100;
                }
                else { //wage at placement case: average wage
                    yVal = seriesByClassStart[s][g].sum / countsByClass[g].sum;
                }
            }
            if (xVal && !isNaN(xVal) && yVal){
                graphData[s].push({ 'x': xVal, 'y': yVal });
            }
        }
    }

    //clean up calc-assistive data before publishing to graph
    var delIndex = seriesNames.indexOf(CALC_ASSIST);
    if (delIndex >= 0){
        seriesNames.splice(delIndex, 1);
        graphData.splice(delIndex, 1);
    }
    return { 'chartType': chartType, 'seriesNames': seriesNames, 'graphData': graphData, 'title': yFieldName + " Over Time" };
}

function graphSeriesData(rowData, yFieldName, startDate, endDate){
    /*Convention: if this function returns null, either we do not have data, or the individual falls
     outside the specified date range.  If this function returns false, we *do* have applicable data
     for that individual, and the data value in question is equal to false.*/
    var rowDataVal = null;
    var rowSeriesBin = null; //the series name to which rowDataVal will be added
    var classStart = Date.parse(rowData.classStart);
    if (isNaN(classStart) || isNaN(startDate) || isNaN(endDate)) return null;
    var adjStartDate = new Date(startDate);
    adjStartDate.setDate(adjStartDate.getDate() - 1);
    if (classStart < adjStartDate || classStart > endDate) return null;
    switch (yFieldName){
        case GENDER_CAT:{
            if (rowData.female) rowSeriesBin = FEMALE;
            else rowSeriesBin = MALE;
            rowDataVal = 1;
            break;
        }
        case AGE_CAT:{ //special case...binned number groups
            if (rowData.ageAtStart){
                var age = rowData.ageAtStart;
                rowDataVal = 1;
                if (age < 18) rowSeriesBin = UNDER_18;
                else if (age < 24) rowSeriesBin = EIGHTEEN_TO_24;
                else if (age < 30) rowSeriesBin = TWENTY_FOUR_TO_30;
                else if (age < 40) rowSeriesBin = THIRTY_TO_FORTY;
                else if (age < 50) rowSeriesBin = FORTY_TO_FIFTY;
                else rowSeriesBin = OVER_FIFTY;
            }
            break;
        }
        case RACE_CAT:{ //String
            if (rowData.ethnicity) {
                rowSeriesBin = rowData.ethnicity;
                rowDataVal = 1;
            }
            break;
        }
        case VET_CAT:{
            if (rowData.veteran) {
                rowSeriesBin = VETERAN;
                rowDataVal = 1;
            }
            else {
                rowSeriesBin = CALC_ASSIST;
                rowDataVal = 1;
            }
            break;
        }
        case WAGE_CAT:{
            if (rowData.wages && rowData.wages.length > 0){
                rowDataVal = rowData.wages[0];
                rowSeriesBin = WAGE_CAT;
            }
            break;
        }
        case PLACE_CAT:{
            if (rowData.employHistory.start) {
                rowDataVal = 1;
                rowSeriesBin = PLACE_CAT;
            }
            else {
                rowSeriesBin = CALC_ASSIST;
                rowDataVal = 1;
            }
            break;
        }
        case GRAD_CAT:{
            if (rowData.gradDate) {
                rowDataVal = 1;
                rowSeriesBin = GRAD_CAT;
            }
            else {
                rowSeriesBin = CALC_ASSIST;
                rowDataVal = 1;
            }
            break;
        }
        default: {}
    }
    if (rowDataVal === null) return null;
    else return { 'seriesName': rowSeriesBin, 'classStart': classStart, 'dataVal': rowDataVal };
}

function genLineGraph(rowData, yFieldName, startDate, endDate){
    var gWidth = 636;
    var gHeight = 480;
    var pad = 50;
    var allData = buildLineData(rowData, yFieldName, startDate, endDate);
    var gData = allData.graphData;
    var series = allData.seriesNames;
    var title = allData.title;
    var palette = d3.scale.category10();

    var legendInfo = [];
    for (var i = 0; i < series.length; i++){
        legendInfo.push({ 'name': series[i], 'color': palette(i) });
    }

    var yAxisLabel = 'Percent (%)';
    var yRange = [0, 100];
    if (allData.chartType == 'average'){ //special case: y-scale for wage chart
      yAxisLabel = 'Average Wage ($/hr)';
      yRange = d3.extent(d3.merge(gData), function(axisData){ return axisData.y; });
      yRange[0] /= 1.5;
      yRange[1] *= 1.25;
    }

    var xScale = d3.time.scale()
        .domain([startDate, endDate])
        .range([pad, gWidth - (pad / 4)]);

    var xAxis = d3.svg.axis()
        .scale(xScale)
        .orient("bottom")
        .ticks(d3.time.months, 6)
        .tickSize(12, 12)
        .tickFormat(d3.time.format("%b. '%y"));

    var yScale = d3.scale.linear()
        .domain([yRange[0], yRange[1]])
        .range([gHeight - pad, pad]);

    var yAxis = d3.svg.axis().scale(yScale).orient("left").ticks(8);

    d3.select("#lineSVG").remove(); //clear chart for rebuild
    d3.select("#legendArea").remove(); //clear line graph legend

    var svg = d3.select('.lineControls')
        .append("svg")
        .attr("id", "lineSVG")
        .attr("width", gWidth)
        .attr("height", gHeight)
        .attr("opacity", "1");

    svg.append("text")
        .attr("x", gWidth / 2)
        .attr("y", 40)
        .style("text-anchor", "middle")
        .style("font-size", "24px")
        .style("font-weight", "500")
        .text(title);

    svg.append("g")
        .attr("class", "axis")
        .attr("transform", "translate(0," + (gHeight - pad) + ")")
        .call(xAxis)
        .append("text")
        .attr("y", 46)
        .attr("x", (gWidth / 2) + pad)
        .style("text-anchor", "end")
        .text('Class Start Date');

    svg.append("g")
        .attr("class", "axis")
        .attr("transform", "translate(" + pad + ",0)")
        .call(yAxis)
        .append("text")
        .attr("transform", "rotate(-90)")
        .attr("y", 6)
        .attr("x", -200)
        .attr("dy", "-2.8em")
        .style("text-anchor", "end")
        .text(yAxisLabel);

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

    linePath.selectAll('circle')
        .data(function (d) { return d; })
        .enter().append('circle')
        .attr('cx', function (d) { return xScale(d.x); })
        .attr('cy', function (d) { return yScale(d.y); })
        .attr('r', 3)
        .style("fill", "white");
    /////////////////////
    //LEGEND STUFF HERE//
    /////////////////////
    var legendSpace = d3.select('#lineControlPanel').append("svg").attr("id", "legendArea");

    var legend = legendSpace.append("g")
       .attr("class", "legend");

    legend.selectAll("rect").data(gData).enter()
       .append("rect")
       .attr("x", 0)
       .attr("y", function(d, i){ return i * 24; })
       .attr("width", 15).attr("height", 15)
       .style("fill", function(d) {
           return legendInfo[gData.indexOf(d)].color;
       });

    legend.selectAll("text").data(gData).enter()
       .append("text").attr("x", 20)
       .attr("y", function(d, i){ return i *  24 + 11; })
       .text(function(d) {
           return legendInfo[gData.indexOf(d)].name;
       });
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
