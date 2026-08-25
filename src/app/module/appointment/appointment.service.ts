import type { UploadApiResponse } from "cloudinary";
import { success } from "zod";
import { da, tr } from "zod/locales";
import {
	AppointmentStatus,
	PaymentStatus,
} from "../../../generated/prisma/enums";
import config from "../../config";
import { getBkashIdToken } from "../../lib/bkash";
import { cloudinary } from "../../lib/cloudinary";
import { prisma } from "../../lib/prisma";
import type { RequestUser } from "../../middleware/checkAuth";
import { AppError } from "../../utils/AppError";
import httpStatus from "http-status";

const bookAppointment = async (payload: any, user: RequestUser) => {
	const transactionResult = await prisma.$transaction(async (tx) => {
		// business logic

		const appointment = await tx.appointment.create({
			data: {
				status: AppointmentStatus.PENDING,
			},
		});

		const bkashIdToken = await getBkashIdToken();

		if (!bkashIdToken) {
			throw new AppError(httpStatus.BAD_GATEWAY, "No Bkash Access Token Available!");
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
					// mode: "0001",
					// payerReference: "01723888888", // user email | phone number
					payerReference: user.email,
					callbackURL: `${config.bkash_callback_url}/appointment/book-appointment/payment/callback`,
					// merchantAssociationInfo: "MI05MID54RF09123456One",
					amount: "1200",
					currency: "BDT",
					intent: "sale",
					// merchantInvoiceNumber: "Inv0124", // appointment Id
					merchantInvoiceNumber: appointment.id, // appointment Id
				}),
			},
		);

		// console.log("bkashCreatePaymentResponse: ", bkashCreatePaymentResponse);

		const bkashCreatePaymentResult = await bkashCreatePaymentResponse.json();

		// Create Payment Model
		await tx.payment.create({
			data: {
				merchantInvoiceNumber: bkashCreatePaymentResult.merchantInvoiceNumber,
				// merchantInvoiceNumber: appointment.id, // alternate for bkash server is down
				appointmentId: appointment.id,
				amount: "1200",
				gatewayResponse: bkashCreatePaymentResult,
				bkashPaymentId: bkashCreatePaymentResult.paymentID,
				payerReference: user.email,
			},
		});

		return { paymentUrl: bkashCreatePaymentResult.bkashURL };
	});

	return transactionResult;
};

const payAppointment = async (payload: any, user: RequestUser) => {
	const appointmentId = payload.appointmentId;

	const existingAppointment = await prisma.appointment.findUnique({
		where: {
			id: appointmentId,
		},
	});

	if (!existingAppointment) {
		throw new AppError(httpStatus.NOT_FOUND, "Appointment Does Not Exists!");
	}

	if (existingAppointment.status !== "PENDING") {
		throw new AppError(httpStatus.BAD_REQUEST, "Appointment Is Not Pending!");
	}

	// if (existingAppointment.status === "CONFIRMED") {
	//     throw new Error("Appointment Already Paid and Confirmed!");
	// }

	// if (
	//     existingAppointment.status === "CANCELLED" ||
	//     existingAppointment.status === "ONGOING" ||
	//     existingAppointment.status === "COMPLETED"
	// ) {
	//     throw new Error(
	//         `Appointment is Already ${existingAppointment.status.toLocaleLowerCase()}`,
	//     );
	// }

	const bkashIdToken = await getBkashIdToken();

	if (!bkashIdToken) {
		throw new AppError(httpStatus.BAD_GATEWAY, "No Bkash Access Token Available!");
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
				// mode: "0001",
				// payerReference: "01723888888", // user email | phone number
				payerReference: user.email,
				callbackURL: `${config.bkash_callback_url}/appointment/book-appointment/payment/callback`,
				// merchantAssociationInfo: "MI05MID54RF09123456One",
				amount: "1200",
				currency: "BDT",
				intent: "sale",
				// merchantInvoiceNumber: "Inv0124", // appointment Id
				merchantInvoiceNumber: existingAppointment.id, // appointment Id
			}),
		},
	);

	const bkashCreatePaymentResult = await bkashCreatePaymentResponse.json();

	await prisma.payment.update({
		where: {
			appointmentId: existingAppointment.id,
			// bkashPaymentId: bkashCreatePaymentResult.paymentID,
		},
		data: {
			merchantInvoiceNumber: bkashCreatePaymentResult.merchantInvoiceNumber,
			// merchantInvoiceNumber: existingAppointment.id, // alternate for bkash server is down
			gatewayResponse: bkashCreatePaymentResult,
			bkashPaymentId: bkashCreatePaymentResult.paymentID,
		},
	});

	return {
		paymentUrl: bkashCreatePaymentResult.bkashURL,
	};
};

const cancelAppointment = async (payload: any) => {
	const transactionResult = await prisma.$transaction(async (tx) => {
		const appointmentId = payload.appointmentId;

		const existingAppointment = await tx.appointment.findUnique({
			where: {
				id: appointmentId,
			},
			include: {
				payment: true,
			},
		});

	if (!existingAppointment) {
		throw new AppError(httpStatus.NOT_FOUND, "Appointment Does Not Exists!");
	}

	if (
		existingAppointment.status === "ONGOING" ||
		existingAppointment.status === "COMPLETED"
	) {
		throw new AppError(
			httpStatus.BAD_REQUEST,
			`Appointment is Already ${existingAppointment.status.toLocaleLowerCase()}`,
		);
	}

	if (existingAppointment.status === "CANCELLED") {
		throw new AppError(httpStatus.BAD_REQUEST, "Appointment Already Cancelled!");
	}

		const updateAppointment = await tx.appointment.update({
			where: {
				id: existingAppointment.id,
			},
			data: {
				status: "CANCELLED",
			},
		});

		const bkashIdToken = await getBkashIdToken();

		if (!bkashIdToken) {
			throw new AppError(httpStatus.BAD_GATEWAY, "No Bkash Access Token Available!");
		}

		const bkashRefundPaymentResponse = await fetch(
			`${config.bkash_base_url}/tokenized/checkout/payment/refund`,
			{
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Accept: "application/json",
					Authorization: bkashIdToken,
					"X-App-key": config.bkash_app_key,
				},
				body: JSON.stringify({
					paymentID: existingAppointment.payment?.bkashPaymentId,
					trxID: existingAppointment.payment?.bkashTrxId,
					amount: existingAppointment.payment?.amount.toString(),
					sku: "Appointment Cancellation",
					reason: "Patient Cencelled The Appointment!",
				}),
			},
		);

		const bkashRefundPaymentResult = await bkashRefundPaymentResponse.json();

		console.log("bkashRefundPaymentResult: ", bkashRefundPaymentResult);

		const updatedPayment = await tx.payment.update({
			where: {
				appointmentId: existingAppointment.id,
			},
			data: {
				refundTrxId: bkashRefundPaymentResult.refundTrxID,
				refundedAt: bkashRefundPaymentResult.completedTime,
				refundAmount: bkashRefundPaymentResult.amount,
				refundReason:
					bkashRefundPaymentResult.reason ??
					"Patient Cencelled The Appointment!",
				status: PaymentStatus.REFUNDED,
				gatewayResponse: bkashRefundPaymentResult,
			},
		});

		return {
			appointment: updateAppointment,
			payment: updatedPayment,
		};
	});

	return transactionResult;
};

// Working Api, Fixed by Gemini
// const cancelAppointment = async (payload: any) => {
//     const transactionResult = await prisma.$transaction(async (tx) => {
//         const appointmentId = payload.appointmentId;

//         const existingAppointment = await tx.appointment.findUnique({
//             where: { id: appointmentId },
//             include: { payment: true },
//         });

//         if (!existingAppointment) {
//             throw new Error("Appointment Does Not Exist!");
//         }

//         if (["ONGOING", "COMPLETED"].includes(existingAppointment.status)) {
//             throw new Error(
//                 `Appointment is Already ${existingAppointment.status.toLowerCase()}`,
//             );
//         }

//         if (existingAppointment.status === "CANCELLED") {
//             throw new Error("Appointment Already Cancelled!");
//         }

//         // 1. Fetch token and explicitly ensure it's a string
//         const bkashIdToken = await getBkashIdToken();

//         if (!bkashIdToken || typeof bkashIdToken !== "string") {
//             throw new Error("No Valid Bkash Access Token Available!");
//         }

//         // 2. Correct bKash Tokenized Refund Endpoint URL
//         // Example base_url: https://tokenized.sandbox.bka.sh/v1.2.0-beta
//         const bkashRefundPaymentResponse = await fetch(
//             `${config.bkash_base_url}/tokenized/checkout/payment/refund`,
//             {
//                 method: "POST",
//                 headers: {
//                     "Content-Type": "application/json",
//                     Accept: "application/json",
//                     Authorization: bkashIdToken,
//                     "X-APP-Key": config.bkash_app_key,
//                 },
//                 body: JSON.stringify({
//                     paymentID: existingAppointment.payment?.bkashPaymentId,
//                     trxID: existingAppointment.payment?.bkashTrxId,
//                     amount: existingAppointment.payment?.amount,
//                     sku: "Appointment Cancellation",
//                     reason: "Patient Cancelled The Appointment!",
//                 }),
//             },
//         );

//         const bkashRefundPaymentResult =
//             await bkashRefundPaymentResponse.json();

//         // 3. Prevent database updates if bKash API returns an error
//         if (bkashRefundPaymentResult.statusCode !== "0000") {
//             throw new Error(
//                 bkashRefundPaymentResult.statusMessage ||
//                     "bKash Refund Failed!",
//             );
//         }

//         const updateAppointment = await tx.appointment.update({
//             where: { id: existingAppointment.id },
//             data: { status: "CANCELLED" },
//         });

//         const updatedPayment = await tx.payment.update({
//             where: { appointmentId: existingAppointment.id },
//             data: {
//                 refundTrxId: bkashRefundPaymentResult.refundTrxId,
//                 refundedAt: bkashRefundPaymentResult.completedTime,
//                 refundAmount: bkashRefundPaymentResult.amount,
//                 refundReason: bkashRefundPaymentResult.reason,
//                 status: PaymentStatus.REFUNDED,
//                 gatewayResponse: bkashRefundPaymentResult,
//             },
//         });

//         return {
//             appointment: updateAppointment,
//             payment: updatedPayment,
//         };
//     });

//     return transactionResult;
// };

const bookAppointmentCallback = async (query: Record<string, any>) => {
	const transactionResult = await prisma.$transaction(async (tx) => {
		const paymentId = query.paymentID;

		if (!paymentId) {
			throw new AppError(httpStatus.BAD_REQUEST, "Payment Id Not Available!");
		}

		const status = query.status;

		if (!status) {
			throw new AppError(httpStatus.BAD_REQUEST, "Payment Status Not Available!");
		}

		const bkashIdToken = await getBkashIdToken();

		if (!bkashIdToken) {
			throw new AppError(httpStatus.BAD_GATEWAY, "Bkash Access Token Not Found!");
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
			await tx.appointment.update({
				where: {
					id: executedPaymentResult.merchantInvoiceNumber,
				},
				data: {
					status: AppointmentStatus.CONFIRMED,
				},
			});

			await tx.payment.update({
				where: {
					appointmentId: executedPaymentResult.merchantInvoiceNumber,
					bkashPaymentId: paymentId,
				},
				data: {
					status: PaymentStatus.PAID,
					bkashTrxId: executedPaymentResult.trxID,
					paidAt: executedPaymentResult.paymentExecuteTime,
					gatewayResponse: executedPaymentResult,
				},
			});

			return {
				redirectUrl: `${config.frontend_url}/dashboard/my-appointment?status=success`,
			};
		} else if (status === "failure") {
			await tx.payment.update({
				where: {
					// appointmentId: executedPaymentResult.merchantInvoiceNumber,
					bkashPaymentId: paymentId,
				},
				data: {
					status: PaymentStatus.FAILED,
					gatewayResponse: executedPaymentResult,
				},
			});

			return {
				redirectUrl: `${config.frontend_url}/dashboard/my-appointments?status=failure`,
			};
		} else if (status === "cancel") {
			await tx.payment.update({
				where: {
					// appointmentId: executedPaymentResult.merchantInvoiceNumber,
					bkashPaymentId: paymentId,
				},
				data: {
					status: PaymentStatus.CANCELLED,
					gatewayResponse: executedPaymentResult,
				},
			});
			return {
				redirectUrl: `${config.frontend_url}/dashboard/my-appointments?status=cancel`,
			};
		} else {
			return {
				executedPaymentResult,
				redirectUrl: `${config.frontend_url}/dashboard/my-appointments?error=payment-failed`,
			};
		}
	});

	return transactionResult;
};

export const AppointmentService = {
	bookAppointment,
	bookAppointmentCallback,
	payAppointment,
	cancelAppointment,
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
