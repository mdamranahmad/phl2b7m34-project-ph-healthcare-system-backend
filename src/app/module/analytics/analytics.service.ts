import httpStatus from "http-status";
import {
	AppointmentStatus,
	DoctorVerificationStatus,
	PaymentStatus,
	ScheduleStatus,
} from "../../../generated/prisma/enums";
import { prisma } from "../../lib/prisma";
import type { RequestUser } from "../../middleware/checkAuth";
import { AppError } from "../../utils/AppError";

const getAdminAnalytics = async () => {
	// Total Registered Doctors
	const totalDoctors = await prisma.doctor.count({
		where: { isDeleted: false },
	});

	const totalPendingDoctorApplications = await prisma.doctor.count({
		where: {
			isDeleted: false,
			verificationStatus: DoctorVerificationStatus.PENDING,
		},
	});

	const totalApprovedDoctorApplications = await prisma.doctor.count({
		where: {
			isDeleted: false,
			verificationStatus: DoctorVerificationStatus.APPROVED,
		},
	});

	const totalRejectedDoctorApplications = await prisma.doctor.count({
		where: {
			isDeleted: false,
			verificationStatus: DoctorVerificationStatus.REJECTED,
		},
	});

	const totalPatient = await prisma.patient.count({
		where: { isDeleted: false },
	});

	const totalAppointment = await prisma.appointment.count();

	const totalCompletedAppointments = await prisma.appointment.count({
		where: {
			status: AppointmentStatus.COMPLETED,
		},
	});

	const totalCancelledAppointments = await prisma.appointment.count({
		where: {
			status: AppointmentStatus.CANCELLED,
		},
	});

	const totalOngoingAppointments = await prisma.appointment.count({
		where: {
			status: AppointmentStatus.ONGOING,
		},
	});

	const totalConfirmedAppointments = await prisma.appointment.count({
		where: {
			status: AppointmentStatus.CONFIRMED,
		},
	});

	const totalRefundResult = await prisma.payment.aggregate({
		where: { status: PaymentStatus.REFUNDED },
		_sum: { amount: true },
	});

	const totalRefunded = totalRefundResult._sum.amount || 0;

	const totalRevenueResult = await prisma.payment.aggregate({
		where: {
			status: PaymentStatus.PAID,
		},
		_sum: { amount: true },
	});

	const totalRevenue =
		Number(totalRevenueResult._sum.amount || 0) - Number(totalRefunded);

	return {
		totalDoctors,
		totalPendingDoctorApplications,
		totalApprovedDoctorApplications,
		totalRejectedDoctorApplications,
		totalPatient,
		totalAppointment,
		totalCompletedAppointments,
		totalCancelledAppointments,
		totalOngoingAppointments,
		totalConfirmedAppointments,
		totalRevenue,
	};
};

const getPatientAnalytics = async (user: RequestUser) => {
	const patient = await prisma.patient.findUnique({
		where: { userId: user.userId },
	});

	if (!patient) {
		throw new AppError(httpStatus.NOT_FOUND, "Patient Profile Not Found!");
	}

	const totalAppointments = await prisma.appointment.count({
		where: { patientId: patient.id },
	});

	const totalUpcomingAppointments = await prisma.appointment.count({
		where: { patientId: patient.id, status: AppointmentStatus.CONFIRMED },
	});

	const totalCompletedAppointments = await prisma.appointment.count({
		where: { patientId: patient.id, status: AppointmentStatus.COMPLETED },
	});

	const totalCancelledAppointments = await prisma.appointment.count({
		where: { patientId: patient.id, status: AppointmentStatus.CANCELLED },
	});

	const totalAmountSpentResult = await prisma.payment.aggregate({
		where: {
			appointment: { patientid: patient.id },
			status: PaymentStatus.PAID,
		},
		_sum: { amount: true },
	});

	const totalAmountSpent = totalAmountSpentResult._sum.amount;

	const totalRefundAmountResult = await prisma.payment.aggregate({
		where: {
			appointment: { patientid: patient.id },
			status: PaymentStatus.REFUNDED,
		},
		_sum: { amount: true },
	});

	const totalRefundAmount = totalRefundAmountResult._sum.amount || 0;

	return {
		totalAppointments,
		totalUpcomingAppointments,
		totalCompletedAppointments,
		totalCancelledAppointments,
		totalAmountSpent,
		totalRefundAmount,
	};
};

const getDoctorAnalytics = async (user: RequestUser) => {
	const doctor = await prisma.doctor.findUnique({
		where: { userId: user.userId },
	});

	if (!doctor) {
		throw new AppError(httpStatus.NOT_FOUND, "Doctor Profile Not Found!");
	}

	const totalSchedules = await prisma.schedule.count({
		where: { doctorId: user.userId, isDeleted: false },
	});

	const totalPublishedSchedules = await prisma.schedule.count({
		where: {
			doctorId: user.userId,
			isDeleted: false,
			status: ScheduleStatus.PUBLISHED,
		},
	});

	const totalAppointment = await prisma.appointment.count({
		where: { doctorId: doctor.id },
	});

	const totalUpcomingAppointment = await prisma.appointment.count({
		where: { doctorId: doctor.id, status: AppointmentStatus.CONFIRMED },
	});

	const totalCompletedAppointments = await prisma.appointment.count({
		where: {
			doctorId: doctor.id,
			status: AppointmentStatus.COMPLETED,
		},
	});

	const totalCancelledAppointments = await prisma.appointment.count({
		where: {
			doctorId: doctor.id,
			status: AppointmentStatus.CANCELLED,
		},
	});

	const totalOngoingAppointments = await prisma.appointment.count({
		where: {
			doctorId: doctor.id,
			status: AppointmentStatus.ONGOING,
		},
	});

	const totalDoctorRefundResult = await prisma.payment.aggregate({
		where: {
			appointment: { doctorId: doctor.id },
			status: PaymentStatus.REFUNDED,
		},
		_sum: { amount: true },
	});

	const totalDoctorRefund = totalDoctorRefundResult._sum.amount || 0;

	const totalDoctorEarningResult = await prisma.payment.aggregate({
		where: { appointment: { doctorId: doctor.id }, status: PaymentStatus.PAID },
		_sum: { amount: true },
	});

	const totalDoctorEarning =
		Number(totalDoctorEarningResult._sum.amount || 0) -
		Number(totalDoctorRefund);

	return {
		totalSchedules,
		totalPublishedSchedules,
		totalAppointment,
		totalUpcomingAppointment,
		totalCompletedAppointments,
		totalCancelledAppointments,
		totalOngoingAppointments,
		totalDoctorEarning,
		totalDoctorRefund,
	};
};

export const AnalyticsServices = {
	getAdminAnalytics,
	getPatientAnalytics,
	getDoctorAnalytics,
};
