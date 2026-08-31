import httpStatus from "http-status";
import {
	AppointmentStatus,
	DoctorVerificationStatus,
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

	return {
		totalAppointments,
		totalUpcomingAppointments,
		totalCompletedAppointments,
		totalCancelledAppointments,
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

	return {
		totalSchedules,
		totalPublishedSchedules,
		totalAppointment,
		totalUpcomingAppointment,
		totalCompletedAppointments,
		totalCancelledAppointments,
		totalOngoingAppointments,
	};
};

export const AnalyticsServices = {
	getAdminAnalytics,
	getPatientAnalytics,
	getDoctorAnalytics,
};
