import { Resend } from 'resend';

// We instantiate Resend dynamically to prevent Next.js build errors when the env var is missing during static analysis
export async function sendInvoiceEmail({
  email,
  name,
  courseTitle,
  planName,
  orderId,
  amount,
  gstAmount,
  total,
}: {
  email: string;
  name: string;
  courseTitle: string;
  planName: string;
  orderId: string;
  amount: number;
  gstAmount: number;
  total: number;
}) {
  if (!process.env.RESEND_API_KEY) {
    console.warn('RESEND_API_KEY is not set. Skipping email dispatch.');
    return;
  }
  const resend = new Resend(process.env.RESEND_API_KEY);

  // Use a verified domain or a test sender. Resend default for testing is usually 'onboarding@resend.dev'
  // But actually, it's safer to use onboarding@resend.dev unless the client verified a domain.
  // Wait, if they use onboarding@resend.dev, it only works if the TO address is the exact same one they registered with.
  const fromEmail = 'onboarding@resend.dev'; 

  const htmlContent = `
    <div style="font-family: sans-serif; max-w-lg: 600px; margin: 0 auto; color: #333;">
      <h2 style="color: #F59E0B;">Enrollment Successful & Tax Invoice</h2>
      <p>Hi <strong>${name}</strong>,</p>
      <p>Welcome aboard! Your enrollment in <strong>${courseTitle}</strong> is now active.</p>
      
      <div style="background-color: #f9fafb; padding: 20px; border-radius: 8px; border: 1px solid #e5e7eb; margin: 20px 0;">
        <h3 style="margin-top: 0;">Order Summary</h3>
        <p><strong>Order ID:</strong> ${orderId}</p>
        <p><strong>Plan Duration:</strong> ${planName}</p>
        <hr style="border-top: 1px solid #e5e7eb;" />
        <div style="display: flex; justify-content: space-between;">
          <span>Base Plan Price:</span>
          <span>₹${amount.toFixed(2)}</span>
        </div>
        <div style="display: flex; justify-content: space-between;">
          <span>18% GST:</span>
          <span>+₹${gstAmount.toFixed(2)}</span>
        </div>
        <div style="display: flex; justify-content: space-between; font-weight: bold; margin-top: 10px; border-top: 1px solid #e5e7eb; padding-top: 10px;">
          <span>Total Paid:</span>
          <span>₹${total.toFixed(2)}</span>
        </div>
      </div>
      
      <p>You can now log in and access your exams from your dashboard.</p>
      <p>Happy Learning,<br/>The MyExams365 Team</p>
    </div>
  `;

  try {
    const data = await resend.emails.send({
      from: `MyExams365 <${fromEmail}>`,
      to: email,
      subject: `Enrollment Successful - ${courseTitle}`,
      html: htmlContent,
    });
    
    console.log('Invoice email sent successfully:', data);
    return data;
  } catch (error) {
    console.error('Failed to send invoice email:', error);
    throw error;
  }
}
