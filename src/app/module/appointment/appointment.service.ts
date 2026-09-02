import { addMinutes, isBefore, isSameDay, subHours } from "date-fns";
import httpStatus from "http-status";
import PDFDocument from "pdfkit";
import {
	AppointmentStatus,
	PaymentStatus,
	Role,
	ScheduleStatus,
} from "../../../generated/prisma/enums";
import type { AppointmentWhereInput } from "../../../generated/prisma/models";
import config from "../../config";
import type { IQuery } from "../../interfaces";
import { getBkashIdToken } from "../../lib/bkash";
import { transporter } from "../../lib/nodemailer";
import { prisma } from "../../lib/prisma";
import type { RequestUser } from "../../middleware/checkAuth";
import { AppError } from "../../utils/AppError";
import type {
	IBookAppointmentPayload,
	ICancelAppointmentPayload,
	IPayAppointmentPayload,
	IUpdateAppointmentStatusPayload,
} from "./appointment.interface";

const bookAppointment = async (
	payload: IBookAppointmentPayload,
	user: RequestUser,
) => {
	const transactionResult = await prisma.$transaction(async (tx) => {
		// business logic
		const patient = await prisma.patient.findUnique({
			where: { userId: user.userId },
		});

		if (!patient) {
			throw new AppError(httpStatus.NOT_FOUND, "Patient Profile Not Found!");
		}

		const schedule = await prisma.schedule.findUnique({
			where: { id: payload.scheduleId },
			include: { doctor: true },
		});

		if (!schedule || schedule.isDeleted) {
			throw new AppError(httpStatus.NOT_FOUND, "Schedule Not Found!");
		}

		if (schedule.status !== ScheduleStatus.PUBLISHED) {
			throw new AppError(
				httpStatus.BAD_REQUEST,
				"This Schedule Is Not Published Yet!",
			);
		}

		const now = new Date();

		if (!isSameDay(now, schedule.startDateTime)) {
			throw new AppError(
				httpStatus.BAD_REQUEST,
				"This Schedule Is Not Available Today!",
			);
		}

		if (!isBefore(now, schedule.startDateTime)) {
			throw new AppError(
				httpStatus.BAD_REQUEST,
				"This Schedule Already Passed!",
			);
		}

		const existingAppointment = await prisma.appointment.findFirst({
			where: {
				patientId: patient.id,
				scheduleId: schedule.id,
				status: { not: AppointmentStatus.CANCELLED },
			},
		});

		if (existingAppointment?.status === AppointmentStatus.PENDING) {
			throw new AppError(
				httpStatus.BAD_REQUEST,
				"You Already Have A Pending Appointment. Please Pay First!",
			);
		}

		if (existingAppointment?.status === AppointmentStatus.CONFIRMED) {
			throw new AppError(
				httpStatus.BAD_REQUEST,
				"You Already Have Confirmed Your Appointment.",
			);
		}
		if (existingAppointment?.status === AppointmentStatus.ONGOING) {
			throw new AppError(
				httpStatus.BAD_REQUEST,
				"You Already Have A Ongoing Appointment.",
			);
		}

		if (existingAppointment?.status === AppointmentStatus.COMPLETED) {
			throw new AppError(
				httpStatus.BAD_REQUEST,
				"You Already Have Completed Your Appointment. Please Try Again Another Day!",
			);
		}

		if (schedule.availableSlots === 0) {
			throw new AppError(
				httpStatus.BAD_REQUEST,
				"There is no schedule available for today!",
			);
		}

		if (!schedule.doctor.consultationFee) {
			throw new AppError(
				httpStatus.BAD_REQUEST,
				"Doctor has not set a consultation fee yet!",
			);
		}

		const amount = schedule.doctor.consultationFee.toString();

		const appointment = await tx.appointment.create({
			data: {
				status: AppointmentStatus.PENDING,
				patientId: patient.id,
				doctorId: schedule.doctor.id,
				scheduleId: schedule.id,
			},
		});

		const bkashIdToken = await getBkashIdToken();

		if (!bkashIdToken) {
			throw new AppError(
				httpStatus.BAD_GATEWAY,
				"No Bkash Access Token Available!",
			);
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
					amount: amount,
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
				amount: amount,
				gatewayResponse: bkashCreatePaymentResult,
				bkashPaymentId: bkashCreatePaymentResult.paymentID,
				payerReference: user.email,
			},
		});

		return { paymentUrl: bkashCreatePaymentResult.bkashURL };
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
	const transactionResult = await prisma.$transaction(
		async (tx) => {
			const paymentId = query.paymentID;

			if (!paymentId) {
				throw new AppError(httpStatus.BAD_REQUEST, "Payment Id Not Available!");
			}

			const status = query.status;

			if (!status) {
				throw new AppError(
					httpStatus.BAD_REQUEST,
					"Payment Status Not Available!",
				);
			}

			const bkashIdToken = await getBkashIdToken();

			if (!bkashIdToken) {
				throw new AppError(
					httpStatus.BAD_GATEWAY,
					"Bkash Access Token Not Found!",
				);
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
				const appointment = await prisma.appointment.findUnique({
					where: { id: executedPaymentResult.merchantInvoiceNumber },
					include: { schedule: true, patient: true, doctor: true },
				});

				if (!appointment) {
					throw new AppError(httpStatus.NOT_FOUND, "Appointment Not Found!");
				}

				const serialNumber =
					appointment.schedule.totalSlots -
					appointment.schedule.availableSlots +
					1;

				const joiningTime = addMinutes(
					appointment.schedule.startDateTime,
					serialNumber - 1 * 20,
				);

				await tx.appointment.update({
					where: {
						id: executedPaymentResult.merchantInvoiceNumber,
					},
					data: {
						status: AppointmentStatus.CONFIRMED,
						joiningTime,
						serialNumber,
					},
				});

				const newAvailableSlots = appointment.schedule.availableSlots - 1;

				await prisma.schedule.update({
					where: { id: appointment.schedule.id },
					data: { availableSlots: newAvailableSlots },
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

				const pdfDocument = new PDFDocument({ margin: 50 });

				const pdfChunks: Buffer[] = [];

				pdfDocument.on("data", (chunk: Buffer) => {
					pdfChunks.push(chunk);
				});

				const pdfReadyPromise = new Promise<Buffer>((resolve) => {
					pdfDocument.on("end", () => {
						resolve(Buffer.concat(pdfChunks));
					});
				});

				pdfDocument
					.fontSize(20)
					.text("PH Healthcare System", { align: "center" });

				pdfDocument
					.fontSize(14)
					.text("Appointment Invoice", { align: "center" });
				pdfDocument.moveDown(2);

				pdfDocument
					.fontSize(12)
					.text(`{Patient Name: ${appointment.patient.name}`);
				pdfDocument.text(`Patient Email: ${appointment.patient.email}`);
				pdfDocument.moveDown();

				pdfDocument
					.fontSize(12)
					.text(`{Doctor Name: ${appointment.doctor.name}`);
				pdfDocument.text(
					`Specialization: ${appointment.doctor.specialization}`,
				);
				pdfDocument.moveDown();

				pdfDocument.text(
					`Appointment Date: ${appointment.schedule.startDateTime.toDateString()}`,
				);
				pdfDocument.text(`Your Joining Time: ${joiningTime.toString()}`);
				pdfDocument.text(`Your Serial Number: ${serialNumber}`);
				pdfDocument.text(`Meeting Link: ${appointment.schedule.meetingLink}`);
				pdfDocument.moveDown();

				pdfDocument.text(`Amount Paid: ${executedPaymentResult.amount} BDT`);
				pdfDocument.text(`Payment Method: bKash`);
				pdfDocument.text(`Transaction Id: ${executedPaymentResult.trxID}`);
				pdfDocument.text(
					`Paid At: ${executedPaymentResult.paymentExecuteTime}`,
				);

				pdfDocument.end();

				const pdfBuffer = await pdfReadyPromise;

				await transporter.sendMail({
					from: config.email_sender,
					to: appointment.patient.email,
					subject: "Your Appointment Invoice - PH Healthcare System",
					text: "Thank you for booking an appointment. Please find your invoice attached.",
					attachments: [
						{
							filename: "invoice.pdf",
							content: pdfBuffer,
						},
					],
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
		},
		{
			maxWait: 5000, // Max time Prisma waits to acquire a transaction lock (default 2000ms)
			timeout: 15000, // Max transaction execution time in ms (e.g., 15000ms = 15s)
		},
	);

	return transactionResult;
};

const payAppointment = async (
	payload: IPayAppointmentPayload,
	user: RequestUser,
) => {
	const appointmentId = payload.appointmentId;

	const existingAppointment = await prisma.appointment.findUnique({
		where: {
			id: appointmentId,
		},
		include: {
			schedule: {
				include: { doctor: true },
			},
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

	if (!existingAppointment.schedule.doctor.consultationFee) {
		throw new AppError(
			httpStatus.BAD_REQUEST,
			"Doctor has not set a consultation fee yet!",
		);
	}

	const amount = existingAppointment.schedule.doctor.consultationFee.toString();

	const bkashIdToken = await getBkashIdToken();

	if (!bkashIdToken) {
		throw new AppError(
			httpStatus.BAD_GATEWAY,
			"No Bkash Access Token Available!",
		);
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
				amount: amount,
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

const cancelAppointment = async (
	payload: ICancelAppointmentPayload,
	user: RequestUser,
) => {
	const transactionResult = await prisma.$transaction(async (tx) => {
		const appointmentId = payload.appointmentId;

		const existingAppointment = await tx.appointment.findUnique({
			where: {
				id: appointmentId,
				patient: {
					email: user.email,
				},
			},
			include: {
				payment: true,
				schedule: true,
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
			throw new AppError(
				httpStatus.BAD_REQUEST,
				"Appointment Already Cancelled!",
			);
		}

		const updateAppointment = await tx.appointment.update({
			where: {
				id: existingAppointment.id,
			},
			data: {
				status: AppointmentStatus.CANCELLED,
			},
		});

		await prisma.schedule.update({
			where: { id: existingAppointment.schedule.id },
			data: { availableSlots: { increment: 1 } },
		});

		// Refund Process
		const now = new Date();

		const startDateTime = existingAppointment.schedule.startDateTime;

		const refundCutOffTime = subHours(startDateTime, 1);

		const isEligibleForRefund = isBefore(now, refundCutOffTime);

		if (isEligibleForRefund) {
			const bkashIdToken = await getBkashIdToken();

			if (!bkashIdToken) {
				throw new AppError(
					httpStatus.BAD_GATEWAY,
					"No Bkash Access Token Available!",
				);
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

			await tx.payment.update({
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
		}

		const newPaymentInfo = await prisma.payment.findUnique({
			where: { appointmentId: existingAppointment.id },
		});

		return {
			appointment: updateAppointment,
			payment: newPaymentInfo,
		};
	});

	return transactionResult;
};

// Doctor Only API Confirmed => Ongoing => Completed
const updateAppointmentStatus = async (
	appointmentId: string,
	payload: IUpdateAppointmentStatusPayload,
	user: RequestUser,
) => {
	const doctor = await prisma.doctor.findUnique({
		where: { userId: user.userId },
	});

	if (!doctor) {
		throw new AppError(httpStatus.NOT_FOUND, "Doctor Profile Not Found!");
	}

	const appointment = await prisma.appointment.findUnique({
		where: { id: appointmentId, doctorId: doctor.id },
	});

	if (!appointment) {
		throw new AppError(httpStatus.NOT_FOUND, "Appointment Not Found!");
	}

	if (appointment.status === AppointmentStatus.COMPLETED) {
		throw new AppError(
			httpStatus.FORBIDDEN,
			"Appointment is already completed!",
		);
	}

	if (appointment.status === AppointmentStatus.CANCELLED) {
		throw new AppError(
			httpStatus.FORBIDDEN,
			"Appointment is already cancelled!",
		);
	}

	if (appointment.status === AppointmentStatus.PENDING) {
		throw new AppError(
			httpStatus.FORBIDDEN,
			"Appointment is still pending. Status can be changed once appointment is confirmed!",
		);
	}

	if (appointment.status === AppointmentStatus.CONFIRMED) {
		if (payload.status !== "ONGOING") {
			throw new AppError(
				httpStatus.BAD_REQUEST,
				"Confirmed appointment must be ongoing at first!",
			);
		}

		await prisma.appointment.update({
			where: { id: appointment?.id },
			data: {
				status: AppointmentStatus.ONGOING,
			},
		});
	}

	if (appointment.status === AppointmentStatus.ONGOING) {
		if (payload.status !== "COMPLETED") {
			throw new AppError(
				httpStatus.BAD_REQUEST,
				"Ongoing appointment must be completed!",
			);
		}

		await prisma.appointment.update({
			where: { id: appointment?.id },
			data: {
				status: AppointmentStatus.COMPLETED,
			},
		});
	}

	const updatedAppointment = await prisma.appointment.findUnique({
		where: { id: appointment.id },
	});

	return updatedAppointment;
};

// Patient Appointments
const getMyAppointments = async (query: IQuery, user: RequestUser) => {
	const limit = query.limit ? Number(query.limit) : 10;
	const page = query.page ? Number(query.page) : 1;
	const skip = (page - 1) * limit;
	const sortBy = query.sortBy ? query.sortBy : "createdAt";
	const sortOrder = query.sortOrder ? query.sortOrder : "desc";

	const patient = await prisma.patient.findUnique({
		where: { userId: user.userId },
	});

	if (!patient) {
		throw new AppError(httpStatus.NOT_FOUND, "Patient Profile Not Found!");
	}

	const andConditions: AppointmentWhereInput[] = [{ patientId: patient.id }];

	if (query.status) {
		andConditions.push({ status: query.status });
	}

	const appointments = await prisma.appointment.findMany({
		where: { AND: andConditions },
		take: limit,
		skip,
		orderBy: { [sortBy]: sortOrder },
		include: {
			doctor: { select: { id: true, name: true, specialization: true } },
			schedule: true,
			payment: true,
		},
	});

	const total = await prisma.appointment.count({
		where: { AND: andConditions },
	});

	return {
		data: appointments,
		meta: {
			page,
			limit,
			total,
			totalPages: Math.ceil(total / limit),
		},
	};
};

// Doctor Appointments
const getDoctorAppointments = async (query: IQuery, user: RequestUser) => {
	const limit = query.limit ? Number(query.limit) : 10;
	const page = query.page ? Number(query.page) : 1;
	const skip = (page - 1) * limit;
	const sortBy = query.sortBy ? query.sortBy : "createdAt";
	const sortOrder = query.sortOrder ? query.sortOrder : "desc";

	const doctor = await prisma.doctor.findUnique({
		where: { userId: user.userId },
	});

	if (!doctor) {
		throw new AppError(httpStatus.NOT_FOUND, "Doctor Profile Not Found!");
	}

	const andConditions: AppointmentWhereInput[] = [{ doctorId: doctor.id }];

	if (query.status) {
		andConditions.push({ status: query.status });
	}

	const appointments = await prisma.appointment.findMany({
		where: { AND: andConditions },
		take: limit,
		skip,
		orderBy: { [sortBy]: sortOrder },
		include: {
			patient: {
				select: { id: true, name: true, email: true, contactNumber: true },
			},
			schedule: true,
			payment: true,
		},
	});

	const total = await prisma.appointment.count({
		where: { AND: andConditions },
	});

	return {
		data: appointments,
		meta: {
			page,
			limit,
			total,
			totalPages: Math.ceil(total / limit),
		},
	};
};

// Admin, Super Admin
const getAllAppointments = async (query: IQuery) => {
	const limit = query.limit ? Number(query.limit) : 10;
	const page = query.page ? Number(query.page) : 1;
	const skip = (page - 1) * limit;
	const sortBy = query.sortBy ? query.sortBy : "createdAt";
	const sortOrder = query.sortOrder ? query.sortOrder : "desc";

	const andConditions: AppointmentWhereInput[] = [];

	if (query.status) {
		andConditions.push({ status: query.status });
	}

	if (query.doctorId) {
		andConditions.push({ doctorId: query.doctorId });
	}

	if (query.patientId) {
		andConditions.push({ patientId: query.patientId });
	}

	if (query.doctorEmail) {
		andConditions.push({ doctor: { email: query.doctorEmail } });
	}

	if (query.patientEmail) {
		andConditions.push({ patient: { email: query.patientEmail } });
	}

	const appointments = await prisma.appointment.findMany({
		where: { AND: andConditions },
		take: limit,
		skip,
		orderBy: { [sortBy]: sortOrder },
		include: {
			patient: {
				select: { id: true, name: true, email: true, contactNumber: true },
			},
			schedule: true,
			payment: true,
		},
	});

	const total = await prisma.appointment.count({
		where: { AND: andConditions },
	});

	return {
		data: appointments,
		meta: {
			page,
			limit,
			total,
			totalPages: Math.ceil(total / limit),
		},
	};
};

// For all logged in users
const getSingleAppointment = async (
	appointmentId: string,
	user: RequestUser,
) => {
	const appointment = await prisma.appointment.findUnique({
		where: { id: appointmentId },
		include: {
			doctor: {
				select: { id: true, name: true, specialization: true, userId: true },
			},
			patient: { select: { id: true, name: true, email: true, userId: true } },
			schedule: true,
			payment: true,
		},
	});

	if (!appointment) {
		throw new AppError(httpStatus.NOT_FOUND, "Appointment Not Found!");
	}

	if (user.role === Role.PATIENT) {
		if (appointment.patient.userId !== user.userId) {
			throw new AppError(
				httpStatus.FORBIDDEN,
				"You are not allowed to view this appointment!",
			);
		}
	}

	if (user.role === Role.DOCTOR) {
		if (appointment.doctor.userId !== user.userId) {
			throw new AppError(
				httpStatus.FORBIDDEN,
				"You are not allowed to view this appointment!",
			);
		}
	}

	return appointment;
};

export const AppointmentService = {
	bookAppointment,
	bookAppointmentCallback,
	payAppointment,
	cancelAppointment,
	updateAppointmentStatus,
	getMyAppointments,
	getDoctorAppointments,
	getAllAppointments,
	getSingleAppointment,
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
