import { setState, getState } from './store.js'

const routes = {
  '/':              () => import('../pages/Dashboard.js'),
  '/login':         () => import('../pages/Login.js'),
  // M1 CRM
  '/crm':           () => import('../pages/crm/CrmDashboard.js'),
  '/crm/leads':     () => import('../pages/crm/Leads.js'),
  '/crm/pipeline':  () => import('../pages/crm/Pipeline.js'),
  '/crm/customers': () => import('../pages/crm/Customers.js'),
  '/crm/bookings':  () => import('../pages/crm/Bookings.js'),
  '/crm/action-plan': () => import('../pages/crm/ActionPlan.js'),
  '/crm/predelivery': () => import('../pages/crm/PreDelivery.js'),
  // M2 DMS
  '/dms':           () => import('../pages/dms/DmsDashboard.js'),
  '/dms/stock':     () => import('../pages/dms/Stock.js'),
  '/dms/orders':    () => import('../pages/dms/VehicleOrders.js'),
  '/dms/pdi':       () => import('../pages/dms/PDI.js'),
  // M3 Service
  '/service':       () => import('../pages/service/ServiceDashboard.js'),
  '/service/jobs':  () => import('../pages/service/JobCards.js'),
  '/service/parts': () => import('../pages/service/Parts.js'),
  // M4 Marketing
  '/marketing':     () => import('../pages/marketing/MarketingDashboard.js'),
  // M5 Finance
  '/finance':       () => import('../pages/finance/FinanceDashboard.js'),
  '/finance/margin':() => import('../pages/finance/Margin.js'),
  '/finance/gp-foc': () => import('../pages/finance/GpFoc.js'),
  '/finance/commission': () => import('../pages/finance/Commission.js'),
  // M6 HR
  '/hr':            () => import('../pages/hr/HrDashboard.js'),
  '/hr/staff':      () => import('../pages/hr/Staff.js'),
  // M7 Training
  '/training':      () => import('../pages/training/TrainingDashboard.js'),
  // M8 Analytics
  '/analytics':     () => import('../pages/analytics/AnalyticsDashboard.js'),
  // M10 Gamification
  '/gamification':  () => import('../pages/gamification/GamificationDashboard.js'),
  // M11 Insurance
  '/insurance':     () => import('../pages/insurance/Insurance.js'),
  // M12 Documents
  '/documents':  () => import('../pages/documents/DocumentStudio.js'),
  // M13 AI Officers
  '/ai/personal': () => import('../pages/ai/PersonalAI.js'),
  '/ai':         () => import('../pages/ai/AiOfficers.js'),
  // M14 Communication Hub
  '/tasks':      () => import('../pages/tasks/Tasks.js'),
  // Finance extras
  '/finance/pl':      () => import('../pages/finance/PL.js'),
  '/finance/payroll': () => import('../pages/finance/Payroll.js'),
  // M18 Integrations
  '/integrations':  () => import('../pages/integrations/Integrations.js'),
  // M20 B2B Portal
  '/b2b':           () => import('../pages/b2b/B2BPortal.js'),
  // M15 Communication Hub
  '/comms':         () => import('../pages/comms/CommHub.js'),
  // M16 V8 Migration
  '/migration':     () => import('../pages/migration/V8Migration.js'),
  // M17 Quality & Compliance
  '/quality':       () => import('../pages/quality/QualityCompliance.js'),
  // HR extras
  '/hr/leave':          () => import('../pages/hr/Leave.js'),
  '/hr/attendance':     () => import('../pages/hr/Attendance.js'),
  '/hr/kpi':            () => import('../pages/hr/KpiManagement.js'),
  '/hr/expense':        () => import('../pages/hr/ExpenseClaims.js'),
  // Service extras
  '/service/appointment': () => import('../pages/service/ServiceAppointment.js'),
  '/service/loaner':      () => import('../pages/service/LoanerCar.js'),
  // Finance extras
  '/finance/cashflow':  () => import('../pages/finance/CashFlow.js'),
  '/finance/invoice':   () => import('../pages/finance/Invoice.js'),
  '/finance/application': () => import('../pages/finance/FinanceApplication.js'),
  // CRM extras
  '/crm/portal':        () => import('../pages/crm/CustomerPortal.js'),
  // Marketing extras
  '/marketing/campaigns': () => import('../pages/marketing/CampaignBuilder.js'),
  '/marketing/social':    () => import('../pages/marketing/SocialHub.js'),
  // HR extras
  '/hr/shift':            () => import('../pages/hr/ShiftSchedule.js'),
  // CRM extras
  '/crm/lostdeals':       () => import('../pages/crm/LostDealAnalysis.js'),
  // Analytics extras
  '/analytics/reports':   () => import('../pages/analytics/ReportCenter.js'),
  // CRM extras
  '/crm/testdrive':     () => import('../pages/crm/TestDrive.js'),
  '/crm/complaints':    () => import('../pages/crm/Complaints.js'),
  // Notifications
  '/notifications':     () => import('../pages/notifications/NotificationCenter.js'),
  // Multi-Branch
  '/settings/branches': () => import('../pages/settings/BranchSettings.js'),
  '/settings/master-data': () => import('../pages/settings/MasterData.js'),
  // CRM extras
  '/crm/showroom':  () => import('../pages/crm/ShowroomAppointment.js'),
  // Service extras
  '/service/warranty': () => import('../pages/service/WarrantyManagement.js'),
  // DMS extras
  '/dms/suppliers':    () => import('../pages/dms/SupplierManagement.js'),
  '/dms/stockvalue':   () => import('../pages/dms/StockValuation.js'),
  '/dms/compare':      () => import('../pages/dms/VehicleComparison.js'),
  // HR extras
  '/hr/recruitment': () => import('../pages/hr/Recruitment.js'),
  // CRM extras
  '/crm/followup':   () => import('../pages/crm/FollowUp.js'),
  '/crm/loyalty':    () => import('../pages/crm/CustomerLoyalty.js'),
  // Service extras
  '/service/inspection': () => import('../pages/service/VehicleInspection.js'),
  // Finance extras
  '/finance/budget': () => import('../pages/finance/BudgetPlanning.js'),
  // Marketing extras
  '/marketing/events': () => import('../pages/marketing/EventManagement.js'),
  // Analytics extras
  '/analytics/kpi':    () => import('../pages/analytics/CompanyKpi.js'),
  // Analytics extras
  '/analytics/forecast':  () => import('../pages/analytics/SalesForecast.js'),
  // Finance extras
  '/finance/tax':         () => import('../pages/finance/TaxReport.js'),
  // Service extras
  '/service/parts-order': () => import('../pages/service/PartsOrder.js'),
  '/service/history':     () => import('../pages/service/ServiceHistory.js'),
  // CRM extras
  '/crm/feedback':        () => import('../pages/crm/CustomerFeedback.js'),
  // HR extras
  '/hr/performance':      () => import('../pages/hr/Performance.js'),
  // Analytics extras
  '/analytics/customers': () => import('../pages/analytics/CustomerInsights.js'),
  // Marketing extras
  '/marketing/leads':     () => import('../pages/marketing/LeadGeneration.js'),
  // Finance extras
  '/finance/tracker':     () => import('../pages/finance/FinanceApplication2.js'),
  // DMS extras
  '/dms/receiving':       () => import('../pages/dms/VehicleReceiving.js'),
  // CRM extras
  '/crm/quotation':       () => import('../pages/crm/QuotationBuilder.js'),
  // Settings extras
  '/settings/audit':      () => import('../pages/settings/AuditLog.js'),
  // Analytics extras
  '/analytics/operations':() => import('../pages/analytics/OperationsDashboard.js'),
  // Insurance extras
  '/insurance/renewal':   () => import('../pages/insurance/InsuranceRenewal.js'),
  // Training extras
  '/training/courses':    () => import('../pages/training/TrainingCourse.js'),
  // Quality extras
  '/quality/sop':         () => import('../pages/quality/SopManagement.js'),
  // B2B extras
  '/b2b/fleet':           () => import('../pages/b2b/FleetManagement.js'),
  // Service extras
  '/service/ev-diagnostic': () => import('../pages/service/EVDiagnostic.js'),
  // Gamification extras
  '/gamification/leaderboard': () => import('../pages/gamification/Leaderboard.js'),
  // Comms extras
  '/comms/inbox': () => import('../pages/comms/CommInbox.js'),
  // AI extras
  '/ai/lami': () => import('../pages/ai/LamiBrain.js'),
  // Document extras
  '/documents/contracts': () => import('../pages/documents/ContractManager.js'),
  // Comms extras
  '/comms/broadcast': () => import('../pages/comms/Broadcast.js'),
  // Integration extras
  '/integrations/settings': () => import('../pages/settings/IntegrationSettings.js'),
  // Finance extras
  '/finance/credit': () => import('../pages/finance/CreditControl.js'),
  // HR extras
  '/hr/orgchart': () => import('../pages/hr/OrgChart.js'),
  // Quality extras
  '/quality/compliance': () => import('../pages/quality/ComplianceCheck.js'),
  // Analytics extras
  '/analytics/profit': () => import('../pages/analytics/ProfitAnalysis.js'),
  // DMS extras
  '/dms/transfer': () => import('../pages/dms/VehicleTransfer.js'),
  // Marketing extras
  '/marketing/content': () => import('../pages/marketing/ContentCalendar.js'),
  // Service extras
  '/service/recall': () => import('../pages/service/RecallManagement.js'),
  // B2B extras
  '/b2b/partners': () => import('../pages/b2b/PartnerPortal.js'),
  // Migration extras
  '/migration/mapping': () => import('../pages/migration/DataMapping.js'),
  // Finance extras
  '/finance/sales-budget': () => import('../pages/finance/SalesBudget.js'),
  '/finance/assets': () => import('../pages/finance/AssetManagement.js'),
  // Gamification extras
  '/gamification/badges': () => import('../pages/gamification/Badges.js'),
  // HR extras
  '/hr/profile': () => import('../pages/hr/StaffProfile.js'),
  // Training extras
  '/training/progress': () => import('../pages/training/TrainingProgress.js'),
  // Analytics extras
  '/analytics/journey': () => import('../pages/analytics/CustomerJourney.js'),
  // Settings extras
  '/settings/notifications': () => import('../pages/settings/NotificationSettings.js'),
  // CRM extras
  '/crm/segments': () => import('../pages/crm/CustomerSegmentation.js'),
  // DMS extras
  '/dms/testdrive-schedule': () => import('../pages/dms/TestDriveScheduler.js'),
  // Finance extras
  '/finance/expenses': () => import('../pages/finance/ExpenseApproval.js'),
  // Service extras
  '/service/packages': () => import('../pages/service/ServicePackage.js'),
  // CRM extras
  '/crm/referral': () => import('../pages/crm/ReferralProgram.js'),
  // Analytics extras
  '/analytics/by-model': () => import('../pages/analytics/SalesByModel.js'),
  // Finance/HR extras
  '/finance/payroll-detail': () => import('../pages/hr/PayrollDetail.js'),
  // Quality extras
  '/quality/satisfaction': () => import('../pages/quality/CustomerSatisfaction.js'),
  // Settings extras
  '/settings/activity': () => import('../pages/settings/UserActivity.js'),
  // Service extras
  '/service/charging': () => import('../pages/service/ChargingStation.js'),
  // DMS extras
  '/dms/pricelist': () => import('../pages/dms/PriceList.js'),
  // Marketing extras
  '/marketing/promotions': () => import('../pages/marketing/PromotionEngine.js'),
  // HR extras
  '/hr/performance-review': () => import('../pages/hr/PerformanceReview.js'),
  // Finance extras
  '/finance/po': () => import('../pages/finance/PurchaseOrder.js'),
  // AI extras
  '/ai/sales-coach': () => import('../pages/ai/SalesCoach.js'),
  // B2B extras
  '/b2b/quotes': () => import('../pages/b2b/CorporateQuote.js'),
  // AI extras
  '/ai/insights': () => import('../pages/ai/AiInsights.js'),
  // Training extras
  '/training/certification': () => import('../pages/training/Certification.js'),
  // Finance extras
  '/finance/goals': () => import('../pages/finance/FinancialGoals.js'),
  // Service extras
  '/service/technicians': () => import('../pages/service/TechnicianSchedule.js'),
  // CRM extras
  '/crm/walkin': () => import('../pages/crm/WalkIn.js'),
  // Analytics extras
  '/analytics/daily': () => import('../pages/analytics/DailyReport.js'),
  // Settings extras
  '/settings/backup': () => import('../pages/settings/BackupRestore.js'),
  // CRM extras
  '/crm/lifecycle': () => import('../pages/crm/CustomerLifecycle.js'),
  // Analytics extras
  '/analytics/stock': () => import('../pages/analytics/StockAnalysis.js'),
  // Finance extras
  '/finance/monthly-close': () => import('../pages/finance/MonthlyClose.js'),
  // Quality extras
  '/quality/audit-schedule': () => import('../pages/quality/AuditSchedule.js'),
  // HR extras
  '/hr/onboarding': () => import('../pages/hr/Onboarding.js'),
  // AI extras
  '/ai/pricing': () => import('../pages/ai/PricingAdvisor.js'),
  // Service extras
  '/service/ev-battery': () => import('../pages/service/EVBattery.js'),
  // Marketing extras
  '/marketing/reviews': () => import('../pages/marketing/CustomerReview.js'),
  // B2B extras
  '/b2b/fleet-quote': () => import('../pages/b2b/FleetQuote.js'),
  // Finance extras
  '/finance/vat': () => import('../pages/finance/VatReport.js'),
  // DMS extras
  '/dms/reservation': () => import('../pages/dms/VehicleReservation.js'),
  // Analytics extras
  '/analytics/monthly': () => import('../pages/analytics/MonthlyTrend.js'),
  // HR extras
  '/hr/salary-scale': () => import('../pages/hr/SalaryScale.js'),
  // Migration extras
  '/migration/export': () => import('../pages/migration/DataExport.js'),
  // Comms extras
  '/comms/sms': () => import('../pages/comms/SMSMarketing.js'),
  // Service extras
  '/service/parts-inventory': () => import('../pages/service/PartsInventory.js'),
  // Insurance extras
  '/insurance/claims': () => import('../pages/insurance/InsuranceClaims.js'),
  // Gamification extras
  '/gamification/challenges': () => import('../pages/gamification/Challenges.js'),
  // Document extras
  '/documents/templates': () => import('../pages/documents/DocumentTemplates.js'),
  // Settings extras
  '/settings/api-keys': () => import('../pages/settings/ApiKeys.js'),
  // Training extras
  '/training/quiz': () => import('../pages/training/TrainingQuiz.js'),
  // CRM extras
  '/crm/birthdays': () => import('../pages/crm/BirthdayGreetings.js'),
  // DMS extras
  '/dms/tradein': () => import('../pages/dms/TradeIn.js'),
  // HR extras
  '/hr/documents': () => import('../pages/hr/StaffDocuments.js'),
  // Marketing extras
  '/marketing/roi': () => import('../pages/marketing/MarketingROI.js'),
  // Service extras
  '/service/reminders': () => import('../pages/service/ServiceReminder.js'),
  // Finance extras
  '/finance/debt': () => import('../pages/finance/DebtCollection.js'),
  // AI extras
  '/ai/lead-scoring': () => import('../pages/ai/LeadScoring.js'),
  // Analytics extras
  '/analytics/branches': () => import('../pages/analytics/BranchComparison.js'),
  // Comms extras
  '/comms/templates': () => import('../pages/comms/ChatTemplates.js'),
  // DMS extras
  '/dms/vin-lookup': () => import('../pages/dms/VinDecoder.js'),
  // HR extras
  '/hr/overtime': () => import('../pages/hr/OvertimeTracking.js'),
  // CRM extras
  '/crm/winback': () => import('../pages/crm/WinBack.js'),
  // Service extras
  '/service/wash': () => import('../pages/service/WashQueue.js'),
  // Finance extras
  '/finance/commission-rules': () => import('../pages/finance/CommissionRules.js'),
  // Settings extras
  '/settings/holidays': () => import('../pages/settings/HolidayCalendar.js'),
  // B2B extras
  '/b2b/partner-commission': () => import('../pages/b2b/PartnerCommission.js'),
  // Quality extras
  '/quality/incidents': () => import('../pages/quality/IncidentReport.js'),
  // DMS extras
  '/dms/accessories': () => import('../pages/dms/AccessoryShop.js'),
  // HR extras
  '/hr/meetings': () => import('../pages/hr/TeamMeeting.js'),
  // Analytics extras
  '/analytics/funnel': () => import('../pages/analytics/ConversionFunnel.js'),
  // Service extras
  '/service/pickup': () => import('../pages/service/CourtesyCar.js'),
  // CRM extras
  '/crm/notes': () => import('../pages/crm/CustomerNotes.js'),
  // Finance extras
  '/finance/petty-cash': () => import('../pages/finance/PettyCash.js'),
  // Marketing extras
  '/marketing/line-oa': () => import('../pages/marketing/LineOaManager.js'),
  // Insurance extras
  '/insurance/compare': () => import('../pages/insurance/InsuranceCompare.js'),
  // HR extras
  '/hr/skills': () => import('../pages/hr/SkillMatrix.js'),
  // Comms extras
  '/comms/calls': () => import('../pages/comms/CallLog.js'),
  // DMS extras
  '/dms/delivery-calendar': () => import('../pages/dms/DeliveryCalendar.js'),
  // Quality extras
  '/quality/pdpa': () => import('../pages/quality/PdpaConsent.js'),
  // Analytics extras
  '/analytics/service': () => import('../pages/analytics/ServiceAnalytics.js'),
  // DMS extras
  '/dms/plates': () => import('../pages/dms/PlateTracking.js'),
  // CRM extras
  '/crm/vip': () => import('../pages/crm/VipClub.js'),
  // Gamification extras
  '/gamification/rewards': () => import('../pages/gamification/RewardStore.js'),
  // Training extras
  '/training/knowledge': () => import('../pages/training/KnowledgeBase.js'),
  // Finance extras
  '/finance/loan-calc': () => import('../pages/finance/LoanCalculator.js'),
  // HR extras
  '/hr/announcements': () => import('../pages/hr/Announcements.js'),
  // DMS extras
  '/dms/demo-fleet': () => import('../pages/dms/DemoFleet.js'),
  // Quality extras
  '/quality/5s': () => import('../pages/quality/FiveS.js'),
  // AI extras
  '/ai/ask': () => import('../pages/ai/AiAssistantChat.js'),
  // Finance extras
  '/finance/bank-recon': () => import('../pages/finance/BankReconciliation.js'),
  // DMS extras
  '/dms/keys': () => import('../pages/dms/KeyManagement.js'),
  // CRM extras
  '/crm/duplicates': () => import('../pages/crm/DuplicateManager.js'),
  // Settings extras
  '/settings/health': () => import('../pages/settings/SystemHealth.js'),
  // Analytics extras
  '/analytics/executive': () => import('../pages/analytics/ExecutiveSummary.js'),
  // Service extras
  '/service/estimate': () => import('../pages/service/RepairEstimate.js'),
  // Settings extras
  '/settings/about': () => import('../pages/settings/About.js'),
  // Finance extras
  '/finance/cashier': () => import('../pages/finance/CashierDesk.js'),
  // HR extras
  '/hr/offboarding': () => import('../pages/hr/Offboarding.js'),
  // B2B extras
  '/b2b/gov-bidding': () => import('../pages/b2b/GovBidding.js'),
  // Service extras
  '/service/lounge': () => import('../pages/service/WaitingLounge.js'),
  // DMS extras
  '/dms/photos': () => import('../pages/dms/CarPhotos.js'),
  // Analytics extras
  '/analytics/parts': () => import('../pages/analytics/PartsAnalytics.js'),
  // Marketing extras
  '/marketing/event-checkin': () => import('../pages/marketing/EventCheckin.js'),
  // Finance extras
  '/finance/charging-cost': () => import('../pages/finance/ChargingCost.js'),
  // DMS extras
  '/dms/floorplan': () => import('../pages/dms/FloorPlanFinance.js'),
  // HR extras
  '/hr/loans': () => import('../pages/hr/StaffLoan.js'),
  // Service extras
  '/service/roadside': () => import('../pages/service/RoadsideAssist.js'),
  // DMS extras
  '/dms/stock-audit': () => import('../pages/dms/StockAudit.js'),
  // CRM extras
  '/crm/map': () => import('../pages/crm/CustomerMap.js'),
  // Settings extras
  '/settings/security': () => import('../pages/settings/SecuritySettings.js'),
  '/settings/users-manage': () => import('../pages/settings/UserManagement.js'),
  '/settings/my-account': () => import('../pages/settings/MyAccount.js'),
  // CRM extras
  '/crm/quote-compare': () => import('../pages/crm/QuotationCompare.js'),
  // Service extras
  '/service/warranty-claim': () => import('../pages/service/WarrantyClaim.js'),
  // DMS extras
  '/dms/delivery':        () => import('../pages/dms/DeliveryNote.js'),
  '/dms/consignment':     () => import('../pages/dms/ConsignmentVehicle.js'),
  '/dms/aging':           () => import('../pages/dms/VehicleAging.js'),
  '/dms/special-edition': () => import('../pages/dms/SpecialEdition.js'),
  // Service extras
  '/service/bay':         () => import('../pages/service/BayManagement.js'),
  '/service/surveyor':    () => import('../pages/service/SurveyorAppointment.js'),
  // Finance extras
  '/finance/deposit':     () => import('../pages/finance/DepositManagement.js'),
  '/finance/breakeven':   () => import('../pages/finance/BreakEven.js'),
  // HR extras
  '/hr/disciplinary':     () => import('../pages/hr/DisciplinaryRecords.js'),
  '/hr/succession':       () => import('../pages/hr/SuccessionPlanning.js'),
  // Insurance extras
  '/insurance/ncb':       () => import('../pages/insurance/NoClaim.js'),
  // CRM extras
  '/crm/fleet':           () => import('../pages/crm/FleetCorporate.js'),
  '/crm/voice-crm':       () => import('../pages/crm/VoiceCrm.js'),
  '/crm/clv':             () => import('../pages/crm/CustomerLifetimeValue.js'),
  '/crm/churn':           () => import('../pages/crm/ChurnPrediction.js'),
  // DMS extras
  '/dms/model-year':      () => import('../pages/dms/ModelYearChangeover.js'),
  '/dms/licenses':        () => import('../pages/dms/DealerLicense.js'),
  // Training extras
  '/training/competitor': () => import('../pages/training/CompetitorIntel.js'),
  // Analytics extras
  '/analytics/market-share': () => import('../pages/analytics/MarketShare.js'),
  // DMS extras
  '/dms/qr-vehicle':     () => import('../pages/dms/QrVehicle.js'),
  '/dms/homologation':   () => import('../pages/dms/Homologation.js'),
  // Integrations
  '/integrations/webhooks': () => import('../pages/integrations/WebhookBuilder.js'),
  // Documents extras
  '/documents/form-builder': () => import('../pages/documents/FormBuilder.js'),
  // Settings extras
  '/settings/digital-signage': () => import('../pages/settings/DigitalSignage.js'),
  // AI extras
  '/ai/upsell':          () => import('../pages/ai/UpsellAdvisor.js'),
  // Service extras
  '/service/ev-range':   () => import('../pages/service/EvRangePlanner.js'),
  '/service/recall-tracker': () => import('../pages/service/RecallTracker.js'),
  // CRM extras
  '/crm/loyalty-tiers':  () => import('../pages/crm/LoyaltyTiers.js'),
  // HR extras
  '/hr/expense-ocr':     () => import('../pages/hr/ExpenseOcr.js'),
  // B2B extras
  '/b2b/fleet-gps':      () => import('../pages/b2b/FleetGps.js'),
  // Settings extras
  '/settings/sms-otp':   () => import('../pages/settings/SmsOtp.js'),
  // Batch 9 extras
  '/marketing/lead-sources':   () => import('../pages/marketing/LeadSources.js'),
  '/dms/td-cert':              () => import('../pages/dms/TdCert.js'),
  '/service/tech-kpi':         () => import('../pages/service/TechKpi.js'),
  '/finance/bank-partners':    () => import('../pages/finance/BankPartners.js'),
  '/crm/anniversary':          () => import('../pages/crm/Anniversary.js'),
  '/dms/reserve-lock':         () => import('../pages/dms/ReserveLock.js'),
  // Vehicle Database
  '/dms/vehicle-db':           () => import('../pages/dms/VehicleDatabase.js'),
  // Batch 15
  '/service/bp':               () => import('../pages/service/BodyRepair.js'),
  '/marketing/ai-content':     () => import('../pages/marketing/AiContentFactory.js'),
  '/finance/payment':          () => import('../pages/finance/PaymentGateway.js'),
  '/comms/meetings':           () => import('../pages/comms/MeetingMinutes.js'),
  '/insurance/policy':         () => import('../pages/insurance/PolicyManagement.js'),
  '/documents/checklist':      () => import('../pages/documents/ChecklistEngine.js'),
  // Batch 14
  '/analytics/model-profit':       () => import('../pages/analytics/ModelProfitability.js'),
  '/comms/escalation':             () => import('../pages/comms/EscalationRules.js'),
  '/b2b/leasing':                  () => import('../pages/b2b/LeasingManagement.js'),
  '/gamification/missions':        () => import('../pages/gamification/DailyMissions.js'),
  '/analytics/report-builder':     () => import('../pages/analytics/ReportBuilder.js'),
  '/dms/ev-station':               () => import('../pages/dms/EvStation.js'),
  // Batch 13
  '/crm/deal-coach':                    () => import('../pages/crm/DealCoach.js'),
  '/dms/gov-docs':                      () => import('../pages/dms/GovDocs.js'),
  '/finance/vendor':                    () => import('../pages/finance/VendorManagement.js'),
  '/analytics/seasonal':                () => import('../pages/analytics/SeasonalTrends.js'),
  '/training/bot':                      () => import('../pages/training/TrainingBot.js'),
  '/finance/compliance-calendar':       () => import('../pages/finance/ComplianceCalendar.js'),
  // Batch 12
  '/crm/price-negotiation':  () => import('../pages/crm/PriceNegotiation.js'),
  '/service/quick-lane':     () => import('../pages/service/QuickLane.js'),
  '/hr/welfare':             () => import('../pages/hr/Welfare.js'),
  '/finance/target-actual':  () => import('../pages/finance/TargetActual.js'),
  '/analytics/ev-adoption':  () => import('../pages/analytics/EvAdoption.js'),
  '/dms/model-config':       () => import('../pages/dms/ModelConfig.js'),
  // Batch 11
  '/marketing/utm-tracker':      () => import('../pages/marketing/UtmTracker.js'),
  '/marketing/digital-showroom': () => import('../pages/marketing/DigitalShowroom.js'),
  '/finance/receipt-auto':       () => import('../pages/finance/ReceiptAuto.js'),
  '/finance/energy':             () => import('../pages/finance/EnergyUtility.js'),
  '/quality/maintenance':        () => import('../pages/quality/Maintenance.js'),
  '/training/product-knowledge': () => import('../pages/training/ProductKnowledge.js'),
  // Batch 10
  '/marketing/sentiment':      () => import('../pages/marketing/SentimentAnalysis.js'),
  '/marketing/landing-pages':  () => import('../pages/marketing/LandingPages.js'),
  '/finance/refund':           () => import('../pages/finance/Refund.js'),
  '/finance/installment':      () => import('../pages/finance/Installment.js'),
  '/dms/color-matrix':         () => import('../pages/dms/ColorMatrix.js'),
  '/dms/used-car':             () => import('../pages/dms/UsedCar.js'),
  // Batch 8 extras
  '/service/warranty-expiry':  () => import('../pages/service/WarrantyExpiry.js'),
  '/service/parts-rma':        () => import('../pages/service/PartsRma.js'),
  '/crm/csat':                 () => import('../pages/crm/Csat.js'),
  '/hr/bonus-pool':            () => import('../pages/hr/BonusPool.js'),
  '/finance/multi-currency':   () => import('../pages/finance/MultiCurrency.js'),
  '/marketing/social-analytics': () => import('../pages/marketing/SocialAnalytics.js'),
  // Batch 7 extras
  '/service/reschedule-ai':    () => import('../pages/service/RescheduleAi.js'),
  '/analytics/carbon':         () => import('../pages/analytics/CarbonFootprint.js'),
  '/dms/price-history':        () => import('../pages/dms/PriceHistory.js'),
  '/crm/referral-qr':          () => import('../pages/crm/ReferralQr.js'),
  '/hr/mood-survey':            () => import('../pages/hr/MoodSurvey.js'),
  '/finance/charging-revenue': () => import('../pages/finance/ChargingRevenue.js'),
  // Settings extras
  '/settings/whitelabel': () => import('../pages/settings/WhiteLabel.js'),
  // M11 Settings
  '/settings':      () => import('../pages/settings/Settings.js'),
  '/settings/company': () => import('../pages/settings/Company.js'),
  '/settings/users':   () => import('../pages/settings/Users.js'),
  '/settings/roles':   () => import('../pages/settings/Roles.js'),
}

const publicRoutes = ['/login']

let currentCleanup = null
let renderGen = 0  // increments on every navigate — stale async renders abort

export function initRouter(appEl) {
  window.addEventListener('popstate', () => render(appEl))
  render(appEl)
}

export function navigate(path) {
  window.history.pushState({}, '', path)
  setState('currentRoute', path)
  const target = document.getElementById('main-content') || document.getElementById('app')
  if (target) render(target)
}

async function render(appEl) {
  const gen = ++renderGen
  const path = window.location.pathname
  setState('currentRoute', path)

  const user = getState('user')
  if (!user && !publicRoutes.includes(path)) {
    navigate('/login')
    return
  }
  if (user && path === '/login') {
    navigate('/')
    return
  }

  if (currentCleanup) { currentCleanup(); currentCleanup = null }

  const loader = routes[path] || routes['/']
  try {
    setState('loading', true)
    const mod = await loader()
    if (gen !== renderGen) return  // navigation happened while loading — abort
    setState('loading', false)
    const page = mod.default
    if (typeof page === 'function') {
      // wrap async pages so they check gen before writing innerHTML
      appEl.__routerGen = gen
      const result = page(appEl)
      if (result && typeof result.then === 'function') {
        result.then(cleanup => { if (gen === renderGen) currentCleanup = cleanup || null }).catch(() => {})
      } else {
        currentCleanup = result || null
      }
    }
  } catch (e) {
    if (gen !== renderGen) return
    setState('loading', false)
    appEl.innerHTML = renderNotFound()
  }
}

function renderNotFound() {
  return `
    <div class="not-found">
      <div class="not-found-icon">🔍</div>
      <h2>ไม่พบหน้าที่ต้องการ</h2>
      <p>หน้านี้ยังไม่มีหรืออาจถูกย้าย</p>
      <button onclick="navigate('/')" class="btn btn-primary">กลับหน้าหลัก</button>
    </div>
  `
}

window.navigate = navigate
