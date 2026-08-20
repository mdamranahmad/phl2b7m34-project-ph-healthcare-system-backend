import type { UploadApiResponse } from "cloudinary";
import { cloudinary } from "../../lib/cloudinary";
import { prisma } from "../../lib/prisma";
import config from "../../config";
import { getBkashIdToken } from "../../lib/bkash";
import { success } from "zod";

const bookAppointment = async () => {
    // business logic

    const bkashIdToken = await getBkashIdToken();

    if (!bkashIdToken) {
        throw new Error("No Bkash Access Token Available!");
    }

    const bkashCreatePaymentResponse = await fetch(
        `${config.bkash_base_url}/tokenized/checkout/create`,
        {
            method: "POST",
            headers: {
                "content-type": "application/json",
                Accept: "application/json",
                Authorization: bkashIdToken,
                "X-app-key": config.bkash_app_key,
            },
            body: JSON.stringify({
                // agreementID: "TokenizedMerchant01L3IKB6H1565072174986", // Appointment
                agreementID: "", // Appointment
                mode: "0011",
                payerReference: "01723888888", // user email | phone number
                callbackURL: `${config.bkash_callback_url}/appointment/book-appointment/payment/callback`,
                // merchantAssociationInfo: "MI05MID54RF09123456One",
                amount: "1200",
                currency: "BDT",
                intent: "sale",
                merchantInvoiceNumber: "Inv0124", // appointment Id
            }),
        },
    );

    const bkashCreatePaymentResult = await bkashCreatePaymentResponse.json();

    return bkashCreatePaymentResult;
};

const bookAppointmentCallback = async (query: Record<string, any>) => {
    const paymentId = query.paymentID;

    if (!paymentId) {
        throw new Error("Payment Id Not Available!");
    }

    const status = query.status;

    if (!status) {
        throw new Error("Payment Status Not Available!");
    }

    const bkashIdToken = await getBkashIdToken();

    if (!bkashIdToken) {
        throw new Error("Bkash Access Token Not Found!");
    }

    const executedPaymentResponse = await fetch(
        `${config.bkash_base_url}/tokenized/checkout/execute`,
        {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Accept: "application/json",
                Authorization: bkashIdToken,
                "x-App-Key": config.bkash_app_key,
            },

            body: JSON.stringify({ paymentID: paymentId }),
        },
    );

    const executedPaymentResult = await executedPaymentResponse.json();

    if (status === "success") {
        return {
            executedPaymentResult,
            redirectUrl: `${config.frontend_url}/dashboard/my-appointment?status=success`,
        };
    }

    if (status === "failure") {
        return {
            executedPaymentResult,
            redirectUrl: `${config.frontend_url}/dashboard/my-appointments?status=failure`,
        };
    }

    if (status === "cancel") {
        return {
            executedPaymentResult,
            redirectUrl: `${config.frontend_url}/dashboard/my-appointments?status=cancel`,
        };
    }

    return {
        executedPaymentResult,
        redirectUrl: `${config.frontend_url}/dashboard/my-appointments`,
    };
};

export const AppointmentService = {
    bookAppointment,
    bookAppointmentCallback,
};

/**
 * bkashCreatePaymentResult:  {
  paymentID: 'TR00111Oz74V71787231867262',
  bkashURL: 'https://sandbox.payment.bkash.com/?paymentId=TR00111Oz74V71787231867262&hash=gJEbhtiIqWTU8-xy498UMV89oTcw6Cl0LDHR(zCtLE95DDHOYjg7**-UsRGBim2!REwpXV_DDnNU!d3GMnOF!RLy2Ah1HbDn6TAW1787231867262&mode=0011&apiVersion=v1.2.0-beta/',
  callbackURL: 'http://localhost:5000/api/v1/appointment/book-appointment/payment/callback',
  successCallbackURL: 'http://localhost:5000/api/v1/appointment/book-appointment/payment/callback?paymentID=TR00111Oz74V71787231867262&status=success&signature=jwWRgCaGTM',
  failureCallbackURL: 'http://localhost:5000/api/v1/appointment/book-appointment/payment/callback?paymentID=TR00111Oz74V71787231867262&status=failure&signature=jwWRgCaGTM',
  cancelledCallbackURL: 'http://localhost:5000/api/v1/appointment/book-appointment/payment/callback?paymentID=TR00111Oz74V71787231867262&status=cancel&signature=jwWRgCaGTM',
  amount: '1200',
  intent: 'sale',
  currency: 'BDT',
  paymentCreateTime: '2026-08-20T19:17:47:262 GMT+0600',
  transactionStatus: 'Initiated',
  merchantInvoiceNumber: 'Inv0124',
  statusCode: '0000',
  statusMessage: 'Successful'
}
req.query:  [Object: null prototype] {
  paymentID: 'TR00111Oz74V71787231867262',
  status: 'success',
  signature: 'jwWRgCaGTM',
  apiVersion: '1.2.0-beta/'
}
 */

/**
 * PAYMENT SUCCESSFUL
 * {
    success: true,
    statusCode: 200,
    message: "Profile picture updated successfully.",
    data: {
        paymentID: "TR00113BMWwl91787233240730",
        trxID: "DHK30PAOSB",
        transactionStatus: "Completed",
        amount: "1200",
        currency: "BDT",
        intent: "sale",
        paymentExecuteTime: "2026-08-20T19:41:03:234 GMT+0600",
        merchantInvoiceNumber: "Inv0124",
        payerType: "Customer",
        payerReference: "01723888888",
        customerMsisdn: "01619777283",
        payerAccount: "01619777283",
        maxRefundableAmount: "1200",
        statusCode: "0000",
        statusMessage: "Successful",
    },
};
 */
/**
 * SECOND PAYMENT FOR SAME PRODUCT
 * {
    success: true,
    statusCode: 200,
    message: "Profile picture updated successfully.",
    data: {
        paymentID: "TR00116aMfnW81787233806705",
        trxID: "DHK50PAOSN",
        transactionStatus: "Completed",
        amount: "1200",
        currency: "BDT",
        intent: "sale",
        paymentExecuteTime: "2026-08-20T19:50:35:582 GMT+0600",
        merchantInvoiceNumber: "Inv0124",
        payerType: "Customer",
        payerReference: "01723888888",
        customerMsisdn: "01619777283",
        payerAccount: "01619777283",
        maxRefundableAmount: "1200",
        statusCode: "0000",
        statusMessage: "Successful",
    },
};

 */
