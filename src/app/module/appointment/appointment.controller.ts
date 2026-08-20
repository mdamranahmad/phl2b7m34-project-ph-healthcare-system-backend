import type { Request, Response } from "express";
import httpStatus from "http-status";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import { AppointmentService } from "./appointment.service";

const bookAppointment = catchAsync(async (req: Request, res: Response) => {
    const result = await AppointmentService.bookAppointment();

    sendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: "Profile picture updated successfully.",
        data: result,
    });
});

const bookAppointmentCallback = catchAsync(
    async (req: Request, res: Response) => {
        console.log("req.query: ", req.query);
        const { executedPaymentResult, redirectUrl } =
            await AppointmentService.bookAppointmentCallback(req.query);

        console.log(
            "Controller executedPaymentResult: ",
            executedPaymentResult,
        );
        res.redirect(redirectUrl);

        // sendResponse(res, {
        //     statusCode: httpStatus.OK,
        //     success: true,
        //     message: "Profile picture updated successfully.",
        //     data: result,
        // });
    },
);

export const AppointmentController = {
    bookAppointment,
    bookAppointmentCallback,
};
