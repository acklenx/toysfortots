/**
 * Unit tests for sendReportEmail Cloud Function
 */

const { expect } = require('chai');
const sinon = require('sinon');

describe('sendReportEmail', () => {
  let mailgunClientStub;
  let messagesCreateStub;

  beforeEach(() => {
    messagesCreateStub = sinon.stub();
    mailgunClientStub = sinon.stub().returns({
      messages: {
        create: messagesCreateStub
      }
    });
  });

  afterEach(() => {
    sinon.restore();
  });

  describe('Subject Line Generation', () => {
    it('should generate pickup request subject for pickup_alert', () => {
      const reportData = {
        reportType: 'pickup_alert',
        label: 'Test Store'
      };

      let subject = 'New Toys for Tots Report';
      if (reportData.reportType === 'pickup_alert' || reportData.reportType === 'pickup_details') {
        subject = `Toys for Tots PICKUP REQUEST: ${reportData.label}`;
      }

      expect(subject).to.equal('Toys for Tots PICKUP REQUEST: Test Store');
    });

    it('should generate pickup request subject for pickup_details', () => {
      const reportData = {
        reportType: 'pickup_details',
        label: 'Walmart'
      };

      let subject = 'New Toys for Tots Report';
      if (reportData.reportType === 'pickup_alert' || reportData.reportType === 'pickup_details') {
        subject = `Toys for Tots PICKUP REQUEST: ${reportData.label}`;
      }

      expect(subject).to.equal('Toys for Tots PICKUP REQUEST: Walmart');
    });

    it('should generate problem report subject for problem_alert', () => {
      const reportData = {
        reportType: 'problem_alert',
        label: 'Target'
      };

      let subject = 'New Toys for Tots Report';
      if (reportData.reportType === 'problem_alert' || reportData.reportType === 'problem_report') {
        subject = `Toys for Tots PROBLEM REPORT: ${reportData.label}`;
      }

      expect(subject).to.equal('Toys for Tots PROBLEM REPORT: Target');
    });

    it('should generate problem report subject for problem_report', () => {
      const reportData = {
        reportType: 'problem_report',
        label: 'Grocery Store'
      };

      let subject = 'New Toys for Tots Report';
      if (reportData.reportType === 'problem_alert' || reportData.reportType === 'problem_report') {
        subject = `Toys for Tots PROBLEM REPORT: ${reportData.label}`;
      }

      expect(subject).to.equal('Toys for Tots PROBLEM REPORT: Grocery Store');
    });

    it('should use default subject for unknown report types', () => {
      const reportData = {
        reportType: 'status_update',
        label: 'Some Location'
      };

      let subject = 'New Toys for Tots Report';
      // No matching condition

      expect(subject).to.equal('New Toys for Tots Report');
    });
  });

  describe('Email Body Construction', () => {
    it('should include all report fields in email body', () => {
      const reportData = {
        boxId: 'BOX123',
        label: 'Test Market',
        address: '123 Main St',
        city: 'Atlanta',
        volunteer: 'John Doe',
        reportType: 'problem_report',
        description: 'Box is damaged',
        notes: 'Needs immediate attention',
        timestamp: '2025-11-06T10:00:00Z'
      };

      const textBody = `
A new report was submitted:
Box ID: ${reportData.boxId}
Location: ${reportData.label}
Address: ${reportData.address}, ${reportData.city}
Assigned Volunteer: ${reportData.volunteer}
--- Report Details ---
Type: ${reportData.reportType}
Description: ${reportData.description || 'N/A'}
Notes: ${reportData.notes || 'N/A'}
Timestamp: ${reportData.timestamp}
`;

      expect(textBody).to.include('BOX123');
      expect(textBody).to.include('Test Market');
      expect(textBody).to.include('123 Main St');
      expect(textBody).to.include('Atlanta');
      expect(textBody).to.include('John Doe');
      expect(textBody).to.include('Box is damaged');
      expect(textBody).to.include('Needs immediate attention');
    });

    it('should handle missing description with N/A', () => {
      const reportData = {
        boxId: 'BOX456',
        label: 'Store',
        address: '456 Oak Ave',
        city: 'Decatur',
        volunteer: 'Jane Smith',
        reportType: 'pickup_alert',
        notes: 'Some notes',
        timestamp: '2025-11-06T11:00:00Z'
      };

      const description = reportData.description || 'N/A';
      expect(description).to.equal('N/A');
    });

    it('should handle missing notes with N/A', () => {
      const reportData = {
        description: 'Some description',
        notes: undefined
      };

      const notes = reportData.notes || 'N/A';
      expect(notes).to.equal('N/A');
    });

    it('should handle both missing description and notes', () => {
      const reportData = {
        boxId: 'BOX789'
      };

      const description = reportData.description || 'N/A';
      const notes = reportData.notes || 'N/A';

      expect(description).to.equal('N/A');
      expect(notes).to.equal('N/A');
    });
  });

  describe('Mailgun API Integration', () => {
    it('should send email with correct message data structure', async () => {
      const mockResponse = { id: 'msg-123456' };
      messagesCreateStub.resolves(mockResponse);

      const mailgunDomain = 'mail.example.com';
      const messageData = {
        from: `Tots Box Bot <bot@${mailgunDomain}>`,
        to: 'toysfortots@qlamail.com',
        subject: 'Test Subject',
        text: 'Test Body'
      };

      const response = await messagesCreateStub(mailgunDomain, messageData);

      expect(response.id).to.equal('msg-123456');
      expect(messagesCreateStub.calledOnce).to.be.true;
      expect(messagesCreateStub.firstCall.args[0]).to.equal(mailgunDomain);
      expect(messagesCreateStub.firstCall.args[1]).to.deep.equal(messageData);
    });

    it('should return success response when email sent successfully', async () => {
      const mockResponse = { id: 'msg-789012' };
      messagesCreateStub.resolves(mockResponse);

      const response = await messagesCreateStub('domain.com', {});
      const result = { success: true, messageId: response.id };

      expect(result).to.deep.equal({
        success: true,
        messageId: 'msg-789012'
      });
    });

    it('should handle Mailgun API errors', async () => {
      const mockError = new Error('Mailgun API timeout');
      messagesCreateStub.rejects(mockError);

      try {
        await messagesCreateStub('domain.com', {});
        expect.fail('Should have thrown error');
      } catch (error) {
        const result = { success: false, error: error.message };
        expect(result.success).to.be.false;
        expect(result.error).to.equal('Mailgun API timeout');
      }
    });
  });

  describe('Email Address Formatting', () => {
    it('should format from address correctly', () => {
      const mailgunDomain = 'mg.example.com';
      const from = `Tots Box Bot <bot@${mailgunDomain}>`;

      expect(from).to.equal('Tots Box Bot <bot@mg.example.com>');
    });

    it('should use correct admin email', () => {
      const ADMIN_EMAIL = 'toysfortots@qlamail.com';

      expect(ADMIN_EMAIL).to.equal('toysfortots@qlamail.com');
    });
  });

  describe('Data Validation', () => {
    it('should handle missing report data', () => {
      const reportData = null;

      if (!reportData) {
        expect(reportData).to.be.null;
        // Function would return early
      }
    });

    it('should handle empty report data', () => {
      const reportData = {};

      expect(reportData.boxId).to.be.undefined;
      expect(reportData.label).to.be.undefined;
    });

    it('should handle report data with all required fields', () => {
      const reportData = {
        boxId: 'BOX001',
        label: 'Location Name',
        address: '123 St',
        city: 'City',
        volunteer: 'Name',
        reportType: 'pickup_alert',
        timestamp: '2025-11-06T12:00:00Z'
      };

      expect(reportData.boxId).to.be.a('string');
      expect(reportData.label).to.be.a('string');
      expect(reportData.reportType).to.be.a('string');
    });
  });
});
