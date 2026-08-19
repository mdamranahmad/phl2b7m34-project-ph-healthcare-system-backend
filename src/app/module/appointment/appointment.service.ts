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

    console.log("bkashIdToken: ", bkashIdToken);

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

    console.log("bkashCreatePaymentResult: ", bkashCreatePaymentResult);

    return bkashCreatePaymentResult;
};

const bookAppointmentCallback = async () => {
    return {
        success: true,
    };
};

export const AppointmentService = {
    bookAppointment,
    bookAppointmentCallback,
};
