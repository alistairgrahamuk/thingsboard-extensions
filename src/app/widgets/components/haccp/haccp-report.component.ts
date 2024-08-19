import { Component, OnInit, Input, ViewChild } from '@angular/core';
import { WidgetContext } from '@app/modules/home/models/widget-component.models';
import { IWidgetSubscription } from '@app/core/api/widget-api.models';
import { HaccpReportModel } from './haccp-report-model';
import { MatTableDataSource } from '@angular/material/table';
import { MatPaginator } from '@angular/material/paginator';
import {ActivatedRoute, Params} from '@angular/router';
import {take} from 'rxjs';
import * as _ from 'lodash';

interface ReportVisuals {
  columnWidth: string| null;
  rowHeight: string | null;
  verticalBorder: boolean;
}

@Component({
  selector: 'tb-haccp-report',
  templateUrl: './haccp-report.component.html',
  styleUrls: ['./haccp-report.component.scss']
})
export class HaccpReportComponent implements OnInit {
  @Input()
  ctx: WidgetContext;
  private reportStart?: number;
  private reportEnd?: number;
  private subscription: IWidgetSubscription;
  private model: HaccpReportModel;
  dataSource = new MatTableDataSource();
  dynamicColumns: Array<string>;
  private unit?: string;
  private timeParams?: Array<string>;
  private okColour: string;
  private dangerColour: string;
  private offlineColour: string;
  private offlineText: string;
  private offlineWindow: number;
  reportVisuals: ReportVisuals | null;
  emptyData = new MatTableDataSource([{ empty: 'row' }]);
  emptyMessage: string;
  private route: ActivatedRoute;
  private report = null;
  private reportInit = false;
  @ViewChild('paginator') paginator: MatPaginator;

  constructor(route: ActivatedRoute) {
    this.route = route;
    this.model = new HaccpReportModel();
  }

  ngOnInit() {
    this.ctx.$scope.haccpTableWidget = this;
    this.subscription = this.ctx.defaultSubscription;
    this.unit = this.ctx.widgetConfig.units ?? '°C';

    if (this.ctx.widgetConfig.noDataDisplayMessage !== undefined && this.ctx.widgetConfig.noDataDisplayMessage.length > 1) {
      this.emptyMessage = this.ctx.widgetConfig.noDataDisplayMessage;
    } else {
      this.emptyMessage = 'No data to display';
    }
    const widgetParams = Object.entries(this.ctx.widgetConfig.settings);

    // Time is camelCase due to limits on the json schema settings in widget config
    const times = this.ctx.settings?.Time ? this.ctx.settings.Time.map(item => item.timeValues) : ['09:00', '12:00', '17:00'];

    const colours = widgetParams.find(item => item[0] === 'thresholdbut');
    const offlineSettings = widgetParams.find(item => item[0] === 'offlinebut');
    const visuals = widgetParams.find(item => item[0] === 'reportVisuals');

    const columnWidth = visuals ? visuals[1].columnWidth : null;
    const rowHeight = visuals ? visuals[1].rowHeight : '28px';
    const verticalBorder = visuals ? visuals[1].verticalBorder : false;

    this.reportVisuals = {columnWidth, rowHeight, verticalBorder};
    this.timeParams = times;
    this.okColour = colours ? colours[1].okColour : '#1EB478';
    this.dangerColour = colours ? colours[1].dangerColour : '#964646';
    this.offlineColour = offlineSettings ? offlineSettings[1].offlineColour : '#D3D3D3';
    this.offlineText = offlineSettings ? offlineSettings[1].offlineText : 'N/A';
    this.offlineWindow = offlineSettings ? offlineSettings[1].offlineWindow : 30;
  }

  ngAfterViewInit() {
    this.dataSource.paginator = this.paginator;
  }

  getReport() {
    const report = this.model.buildHaccpReport(this.subscription.data, this.timeParams, this.offlineWindow);
    if (report.devices.length > 0) {
      this.report = report;
    }

    const thisReportDevices = this.report?.devices;
    const reportDevices = report?.devices;
    if(_.isEqual(thisReportDevices, reportDevices) && report.devices.length > 0 && this.reportInit) {
      return false;
    }

    if (report.devices.length > 0 && report.startDate !== '' && report.endDate !== '' ) {
      this.reportInit = true;
    }

    this.dynamicColumns = ['Date', ...this.model.getDeviceNames(report.devices)];
    try {
      const rows = this.model.mapToRows(
        report.devices,
        this.unit,
        this.timeParams,
        this.okColour,
        this.dangerColour,
        this.offlineColour,
        this.offlineText
      );

      // rows for custom download
      this.ctx.settings.downloadRows = rows;

      const reportBoundRows = this.model.filterOnReportBounds(
          this.reportStart,
          this.reportEnd,
          rows
      );

      this.dataSource = new MatTableDataSource(reportBoundRows);
      this.dataSource.paginator = this.paginator;

      let myParam;
      this.route.queryParams
          .pipe(take(1))
          .subscribe((value: Params)=> {
            myParam = value.pageSize;
          });

      this.dataSource.paginator.pageSize = myParam ? parseInt(myParam) : 30;

    } catch (e) {
      console.log('Caught exception while building rows for HACCP report:', e);
      return false;
    }
  }

  // Called when the new data is available from the widget subscription.
  // Latest data can be accessed from the defaultSubscription object of widget context (ctx).
  onDataUpdated() {
    const reportTimeWindow = this.ctx.timeWindow;
    this.reportStart = reportTimeWindow.minTime;
    this.reportEnd =  reportTimeWindow.maxTime;
    this.getReport();
  }

  // The first function that is called when the widget is ready for initialization.
  // It should be used to prepare widget DOM, process widget settings and handle initial subscription information.
  onInit() {
  }

  onResize() {
    this.ctx.detectChanges();
  }

  onEditModeChanged() {
    this.ctx.detectChanges();
  }

  // required in widget config
  onMobileModeChanged() {
  }

  // required in widget config
  onDestroy() {
  }
}
