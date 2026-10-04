import nodemailer from 'nodemailer';

export interface EmailSettings {
  restaurantName?: string;
  contactPhone?: string;
  address?: string;
  fssaiLicenseNumber?: string;
  senderEmail?: string;
  senderEmailPassword?: string;
  senderName?: string;
  smtpHost?: string;
  smtpPort?: number;
}

export type OrderCategoryType = 'food_only' | 'non_food_only' | 'mixed';

export function isNonFoodItem(item: any): boolean {
  if (!item) return false;
  
  if (item.product?.isNonFood === true || item.isNonFood === true) return true;
  if (item.product?.isNonFood === false || item.isNonFood === false) return false;

  const category = String(item.product?.category || item.category || '').toLowerCase();
  const name = String(item.product?.name || item.name || '').toLowerCase();

  const nonFoodKeywords = [
    'candle', 'candles', 'balloon', 'balloons', 'party', 'cap', 'caps', 'prop', 'props',
    'decoration', 'decor', 'gift', 'tag', 'popper', 'spray', 'snow spray',
    'sparkler', 'knife', 'topper', 'cake topper', 'banner', 'ribbon', 'utensil',
    'crockery', 'accessories', 'toy', 'card', 'greeting card'
  ];

  return nonFoodKeywords.some((kw) => category.includes(kw) || name.includes(kw));
}

export function classifyOrder(order: any): OrderCategoryType {
  const items = Array.isArray(order?.items) ? order.items : [];
  if (items.length === 0) return 'food_only';

  const nonFoodCount = items.filter(isNonFoodItem).length;
  const foodCount = items.length - nonFoodCount;

  if (nonFoodCount > 0 && foodCount === 0) {
    return 'non_food_only';
  }
  if (nonFoodCount > 0 && foodCount > 0) {
    return 'mixed';
  }
  return 'food_only';
}

export function buildOrderStatusEmailHtml(params: {
  order: any;
  status: string;
  settings?: EmailSettings;
  appUrl?: string;
}): string {
  const { order, status, settings = {} } = params;

  const restaurantName = settings.restaurantName || 'Gidhaur Bakery';
  const fssaiLic = settings.fssaiLicenseNumber || '20426191000010';
  const customerName = order.customerName || 'Valued Guest';
  const orderId = order.orderId || order.id || 'ORDER';

  // Smart Context-Aware Messaging: Differentiates pure food, pure non-food, and mixed orders
  const orderType = classifyOrder(order);

  let statusTitle = 'Order Placed';
  let statusSubtext = 'We have received your order and the store team is reviewing it.';

  if (orderType === 'non_food_only') {
    switch (status) {
      case 'pending':
        statusTitle = 'Order Placed';
        statusSubtext = 'We have received your order and our store team is verifying your items.';
        break;
      case 'accepted':
        statusTitle = 'Order Confirmed';
        statusSubtext = 'Great news! Your order has been confirmed and our store team is preparing your package for dispatch.';
        break;
      case 'preparing':
        statusTitle = 'Packing in Progress';
        statusSubtext = 'Your items are being carefully inspected, packed, and secured for safe transit.';
        break;
      case 'out_for_delivery':
        statusTitle = 'Out for Delivery';
        statusSubtext = 'Your package is safely packed and our delivery rider is on the way to your address!';
        break;
      case 'delivered':
        statusTitle = 'Delivered Successfully';
        statusSubtext = `Your package has been safely delivered! We hope you love your purchase. Thank you for shopping with ${restaurantName}.`;
        break;
      case 'rejected':
        statusTitle = 'Order Cancelled';
        statusSubtext = 'Your order cancellation request has been accepted. If you made an online payment, a full refund will be processed.';
        break;
      case 'cancellation_declined':
        statusTitle = 'Cancellation Declined';
        statusSubtext = 'Your cancellation request was declined as your package is already packed and dispatched. It will arrive shortly!';
        break;
    }
  } else if (orderType === 'mixed') {
    switch (status) {
      case 'pending':
        statusTitle = 'Order Placed';
        statusSubtext = 'We have received your order for both fresh bakery items and celebration essentials. Our team is reviewing it.';
        break;
      case 'accepted':
        statusTitle = 'Order Confirmed';
        statusSubtext = 'Great news! Your order is confirmed. Our kitchen is preparing your bakery treats while our team packs your party items.';
        break;
      case 'preparing':
        statusTitle = 'Preparing & Packing';
        statusSubtext = 'Your fresh treats are being handcrafted, and your celebration accessories are being carefully packed.';
        break;
      case 'out_for_delivery':
        statusTitle = 'Out for Delivery';
        statusSubtext = 'Your complete package has been dispatched and our delivery rider is on the way to your address!';
        break;
      case 'delivered':
        statusTitle = 'Delivered Successfully';
        statusSubtext = `Your complete order has been safely delivered! We hope you enjoy your treats and have a wonderful celebration. Thank you for choosing ${restaurantName}.`;
        break;
      case 'rejected':
        statusTitle = 'Order Cancelled';
        statusSubtext = 'Your order cancellation request has been accepted. If you made an online payment, a full refund will be processed.';
        break;
      case 'cancellation_declined':
        statusTitle = 'Cancellation Declined';
        statusSubtext = 'Your cancellation request was declined as your order is already prepared and packed. It will arrive shortly!';
        break;
    }
  } else {
    // Pure Food Order (food_only)
    switch (status) {
      case 'pending':
        statusTitle = 'Order Placed';
        statusSubtext = 'We have received your order and the store team is reviewing it.';
        break;
      case 'accepted':
        statusTitle = 'Order Confirmed';
        statusSubtext = 'Great news! Our chef has accepted your order and is freshly preparing your items.';
        break;
      case 'preparing':
        statusTitle = 'Order in Kitchen';
        statusSubtext = 'Your delicious delicacies are currently being handcrafted with fresh ingredients.';
        break;
      case 'out_for_delivery':
        statusTitle = 'Out for Delivery';
        statusSubtext = 'Your freshly prepared food is packed and our delivery rider is on the way to your address!';
        break;
      case 'delivered':
        statusTitle = 'Delivered Successfully';
        statusSubtext = `Your order has been safely delivered. We hope you enjoy your meal! Thank you for choosing ${restaurantName}.`;
        break;
      case 'rejected':
        statusTitle = 'Order Cancelled';
        statusSubtext = 'Your order cancellation request has been accepted. If you made an online payment, a full refund will be processed.';
        break;
      case 'cancellation_declined':
        statusTitle = 'Cancellation Declined';
        statusSubtext = 'Your cancellation request was declined as your food is already being freshly prepared / dispatched. Your meal will arrive shortly!';
        break;
    }
  }

  const itemsHtml = Array.isArray(order.items)
    ? order.items
        .map((item: any) => {
          const itemName = item.product?.name || item.name || 'Item';
          const variant = item.selectedVariant?.name ? `(${item.selectedVariant.name})` : '';
          const qty = item.quantity || 1;
          const price = item.selectedVariant?.price ?? item.product?.price ?? item.price ?? 0;
          const itemTotal = price * qty;
          return `
            <tr>
              <td style="padding: 11px 0; border-bottom: 1px solid #e2e8f0; color: #1e293b; font-size: 14px; font-weight: 600;">
                ${itemName} <span style="font-size: 12px; color: #64748b; font-weight: normal;">${variant}</span>
              </td>
              <td style="padding: 11px 0; border-bottom: 1px solid #e2e8f0; text-align: center; color: #64748b; font-size: 13px; font-weight: 700;">
                × ${qty}
              </td>
              <td style="padding: 11px 0; border-bottom: 1px solid #e2e8f0; text-align: right; color: #0f172a; font-size: 14px; font-weight: 700; font-family: monospace;">
                ₹${itemTotal}
              </td>
            </tr>
          `;
        })
        .join('')
    : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="light">
  <meta name="supported-color-schemes" content="light">
  <title>Order #${orderId} - ${restaurantName}</title>
  <style>
    :root {
      color-scheme: light;
      supported-color-schemes: light;
    }
    body {
      margin: 0;
      padding: 0;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      background-color: #f8fafc;
      color: #0f172a;
      -webkit-font-smoothing: antialiased;
    }
    /* Responsive card expanding edge-to-edge on mobile to eliminate square gaps */
    @media only screen and (max-width: 600px) {
      body, table.email-outer-table {
        width: 100% !important;
        margin: 0 !important;
        padding: 0 !important;
      }
      .email-card-cell {
        padding: 6px 4px !important;
      }
      .email-card {
        width: 100% !important;
        max-width: 100% !important;
        border-radius: 36px !important;
      }
      .email-content-pad {
        padding-left: 16px !important;
        padding-right: 16px !important;
      }
      .email-header-pad {
        padding: 24px 16px 20px 16px !important;
      }
    }
  </style>
</head>
<body style="margin: 0; padding: 0; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #0f172a;">
  <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" class="email-outer-table" style="background-color: #f8fafc; margin: 0; padding: 14px 0;">
    <tr>
      <td align="center" class="email-card-cell" style="padding: 12px 6px;">
        
        <!-- Main Card with 60 Soft Curved Corners & Refined Original Bakery Palette -->
        <table role="presentation" class="email-card" style="width: 100%; max-width: 580px; margin: 0 auto; background-color: #ffffff; border-radius: 40px; overflow: hidden; border: 1px solid #e2e8f0; box-shadow: 0 6px 24px rgba(0,0,0,0.04);">
          
          <!-- Original Clean Header Banner with Top Soft Corners & Amber Eyebrow -->
          <tr>
            <td class="email-header-pad" style="background-color: #ffffff; padding: 30px 24px 22px 24px; text-align: center; border-bottom: 1px solid #f1f5f9;">
              <span style="font-size: 11px; font-weight: 800; letter-spacing: 2px; text-transform: uppercase; color: #b45309; display: block; margin-bottom: 6px;">
                ★ ${restaurantName.toUpperCase()} ★
              </span>
              <h1 style="margin: 0; font-size: 24px; font-weight: 900; color: #0f172a; letter-spacing: -0.5px;">
                ${statusTitle}
              </h1>
              <div style="margin-top: 10px;">
                <span style="display: inline-block; background-color: #f1f5f9; color: #1e293b; font-size: 12px; font-weight: 700; padding: 5px 16px; border-radius: 24px; border: 1px solid #e2e8f0; font-family: monospace;">
                  Order #${orderId}
                </span>
              </div>
            </td>
          </tr>

          <!-- Greeting & Status Notice -->
          <tr>
            <td class="email-content-pad" style="padding: 22px 24px 16px 24px;">
              <p style="margin: 0 0 6px 0; font-size: 16px; font-weight: 800; color: #0f172a;">
                Hi ${customerName},
              </p>
              <p style="margin: 0; font-size: 14px; line-height: 1.5; color: #475569;">
                ${statusSubtext}
              </p>
            </td>
          </tr>

          <!-- Order Items Table Card with Soft Rounded Corners (border-radius: 24px) -->
          <tr>
            <td class="email-content-pad" style="padding: 0 24px 16px 24px;">
              <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 24px; padding: 18px 20px;">
                <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0">
                  <thead>
                    <tr>
                      <th align="left" style="font-size: 11px; font-weight: 800; text-transform: uppercase; color: #64748b; padding-bottom: 8px;">ITEM</th>
                      <th align="center" style="font-size: 11px; font-weight: 800; text-transform: uppercase; color: #64748b; padding-bottom: 8px;">QTY</th>
                      <th align="right" style="font-size: 11px; font-weight: 800; text-transform: uppercase; color: #64748b; padding-bottom: 8px;">PRICE</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${itemsHtml}
                  </tbody>
                </table>

                <!-- Bill Totals -->
                <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="margin-top: 12px; border-top: 1px dashed #cbd5e1; padding-top: 12px;">
                  <tr>
                    <td style="font-size: 13px; color: #64748b; padding: 3px 0;">Items Subtotal</td>
                    <td align="right" style="font-size: 13px; font-weight: 600; color: #1e293b; padding: 3px 0; font-family: monospace;">₹${order.subtotal || order.totalAmount || 0}</td>
                  </tr>
                  <tr>
                    <td style="font-size: 13px; color: #64748b; padding: 3px 0;">Delivery Fee</td>
                    <td align="right" style="font-size: 13px; font-weight: 700; color: #059669; padding: 3px 0;">FREE</td>
                  </tr>
                  <tr>
                    <td style="font-size: 16px; font-weight: 900; color: #0f172a; padding: 8px 0 0 0;">Total Amount</td>
                    <td align="right" style="font-size: 18px; font-weight: 900; color: #0f172a; padding: 8px 0 0 0; font-family: monospace;">₹${order.totalAmount || 0}</td>
                  </tr>
                  <tr>
                    <td style="font-size: 11px; color: #64748b; padding-top: 4px;">Payment Method</td>
                    <td align="right" style="font-size: 11px; font-weight: 700; color: #475569; padding-top: 4px; text-transform: uppercase;">
                      ${order.paymentMethod || 'COD / UPI'} (${order.paymentStatus === 'paid' ? 'PAID' : 'PAY ON DELIVERY'})
                    </td>
                  </tr>
                </table>
              </div>
            </td>
          </tr>

          <!-- Delivery Address with Soft Corners (border-radius: 20px) -->
          <tr>
            <td class="email-content-pad" style="padding: 0 24px 22px 24px;">
              <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #f8fafc; border-radius: 20px; padding: 14px 18px; border: 1px solid #e2e8f0;">
                <tr>
                  <td>
                    <span style="font-size: 11px; font-weight: 800; text-transform: uppercase; color: #64748b; display: block; margin-bottom: 3px;">
                      📍 DELIVERY ADDRESS
                    </span>
                    <span style="font-size: 13px; color: #1e293b; font-weight: 600; line-height: 1.4;">
                      ${order.address || 'Address provided at checkout'}
                    </span>
                    ${order.notes ? `<div style="margin-top: 6px; font-size: 12px; color: #475569; font-style: italic;">Note: "${order.notes}"</div>` : ''}
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Official FSSAI Compliance & Footer (No Live Tracking Button) -->
          <tr>
            <td style="background-color: #f8fafc; border-top: 1px solid #e2e8f0; padding: 22px 24px; text-align: center; border-radius: 0 0 40px 40px;">
              
              <!-- Official FSSAI Badge with Soft Rounded Corners -->
              <div style="display: inline-block; padding: 7px 16px; background-color: #ffffff; border: 1px solid #cbd5e1; border-radius: 16px; margin-bottom: 12px;">
                <table role="presentation" border="0" cellspacing="0" cellpadding="0">
                  <tr>
                    <td style="vertical-align: middle; padding-right: 8px;">
                      <span style="display: inline-block; font-size: 14px; font-weight: 900; letter-spacing: -0.5px; color: #0284c7; font-family: 'Arial Black', sans-serif;">
                        fssai
                      </span>
                    </td>
                    <td style="vertical-align: middle; border-left: 1px solid #e2e8f0; padding-left: 8px; text-align: left;">
                      <span style="font-size: 10px; color: #64748b; font-weight: 700; text-transform: uppercase; display: block; line-height: 1;">
                        Lic. No.
                      </span>
                      <span style="font-size: 12px; color: #0f172a; font-weight: 800; font-family: monospace; letter-spacing: 0.5px;">
                        ${fssaiLic}
                      </span>
                    </td>
                  </tr>
                </table>
              </div>

              <!-- Store Support Info -->
              <p style="margin: 0 0 4px 0; font-size: 11px; color: #64748b;">
                ${settings.address || 'Main Market Road, Gidhaur'} • Helpline: <a href="tel:${settings.contactPhone || '+919876543210'}" style="color: #0284c7; text-decoration: none; font-weight: 700;">${settings.contactPhone || '+91 98765 43210'}</a>
              </p>
              <p style="margin: 0; font-size: 10px; color: #94a3b8;">
                100% Quality & Hygiene Assured • Thank you for choosing ${restaurantName}
              </p>
            </td>
          </tr>

        </table>

      </td>
    </tr>
  </table>
</body>
</html>`;
}

export async function sendOrderNotificationEmail(params: {
  order: any;
  status: string;
  recipientEmail: string;
  settings?: EmailSettings;
  appUrl?: string;
}): Promise<{ success: boolean; message: string; previewMode?: boolean }> {
  const { order, status, recipientEmail, settings = {}, appUrl = '' } = params;

  if (!recipientEmail || !recipientEmail.includes('@')) {
    return { success: false, message: 'Invalid recipient email address' };
  }

  const restaurantName = settings.restaurantName || 'Gidhaur Bakery';
  const orderId = order.orderId || order.id || 'ORDER';

  let subject = `Order #${orderId} - ${restaurantName}`;
  switch (status) {
    case 'pending':
      subject = `🍽️ Order Placed Successfully! #${orderId} - ${restaurantName}`;
      break;
    case 'accepted':
    case 'preparing':
      subject = `👨‍🍳 Order Confirmed & In Kitchen! #${orderId} - ${restaurantName}`;
      break;
    case 'out_for_delivery':
      subject = `🛵 Out for Delivery! #${orderId} is on the way`;
      break;
    case 'delivered':
      subject = `🎉 Delivered! Enjoy your delicious meal #${orderId}`;
      break;
    case 'rejected':
      subject = `⚠️ Order #${orderId} Status Update - ${restaurantName}`;
      break;
    case 'cancellation_declined':
      subject = `ℹ️ Order #${orderId} Update: Cancellation Request Declined - ${restaurantName}`;
      break;
  }

  const html = buildOrderStatusEmailHtml({ order, status, settings, appUrl });

  // Resolve sender credentials (admin settings take priority, fallback to environment)
  const user = settings.senderEmail || process.env.SMTP_USER || '';
  const pass = settings.senderEmailPassword || process.env.SMTP_PASS || '';
  const fromName = settings.senderName || restaurantName;

  if (!user || !pass) {
    console.log(
      `[Email Preview Mode] Order #${orderId} email simulated for ${recipientEmail}. Subject: "${subject}". To deliver to customer inboxes, configure Gmail & App Password in Admin Settings.`
    );
    return {
      success: true,
      previewMode: true,
      message: `Email preview generated for ${recipientEmail}. Enter your Gmail and App Password in Admin Settings to deliver directly to customer inboxes.`,
    };
  }

  try {
    const isGmail = user.includes('@gmail.com');
    const transporter = nodemailer.createTransport(
      isGmail
        ? {
            service: 'gmail',
            auth: { user, pass },
          }
        : {
            host: settings.smtpHost || 'smtp.gmail.com',
            port: settings.smtpPort || 465,
            secure: (settings.smtpPort || 465) === 465,
            auth: { user, pass },
          }
    );

    const info = await transporter.sendMail({
      from: `"${fromName}" <${user}>`,
      to: recipientEmail,
      subject,
      html,
    });

    console.log(`[Email Delivered] Order #${orderId} email sent to ${recipientEmail} (ID: ${info.messageId})`);
    return {
      success: true,
      message: `Email successfully delivered to ${recipientEmail}`,
    };
  } catch (err: any) {
    console.error(`[Email Send Error] Failed to send email to ${recipientEmail}:`, err?.message || err);
    return {
      success: false,
      message: `Failed to send email: ${err?.message || 'SMTP Connection Error. Please verify your Gmail and 16-character App Password.'}`,
    };
  }
}
