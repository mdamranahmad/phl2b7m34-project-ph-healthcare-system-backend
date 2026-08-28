import { addDays, differenceInMinutes, startOfDay } from "date-fns";
import { name } from "ejs";
import httpStatus from "http-status";
import { prisma } from "../../lib/prisma";
import type { RequestUser } from "../../middleware/checkAuth";
import { AppError } from "../../utils/AppError";
import type { ICreateSchedulePayload } from "./schedule.interface";

const createSchedule = async (
	payload: ICreateSchedulePayload,
	user: RequestUser,
) => {
	const doctor = await prisma.doctor.findUnique({
		where: { userId: user.userId },
	});

	if (!doctor) {
		throw new AppError(httpStatus.NOT_FOUND, "Doctor Profile Not Found!");
	}

	const startOfTheDay = startOfDay(payload.startDateTime);
	const startOfNextDay = addDays(startOfTheDay, 1);

	const existingScheduleOnThisDate = await prisma.schedule.findFirst({
		where: {
			doctorId: doctor.id,
			isDeleted: false,
			startDateTime: {
				gte: startOfTheDay,
				lt: startOfNextDay,
			},
		},
	});

	if (!existingScheduleOnThisDate) {
		throw new AppError(
			httpStatus.CONFLICT,
			"You already have a schedule for this date!",
		);
	}

	const durationInMinutes = differenceInMinutes(
		payload.startDateTime,
		payload.endtDateTime,
	);

	const MINUTES_ALLOCATED_PER_SLOT = 20;

	const totalSlots = Math.floor(durationInMinutes / MINUTES_ALLOCATED_PER_SLOT);

	const schedule = await prisma.schedule.create({
		data: {
			startDateTime: payload.startDateTime,
			endDateTime: payload.endtDateTime,
			meetingLink: payload.meetingLink,
			totalSlots,
			availableSlots: totalSlots,
			doctorId: doctor.id,
		},
		include: {
			doctor: {
				select: {
					name: true,
					email: true,
					contactNumber: true,
				},
			},
		},
	});

	return schedule;
};

export const ScheduleService = {
	createSchedule,
};
