import cookieParser from "cookie-parser";
import cors from "cors";
import express, {
    type Application,
    type NextFunction,
    type Request,
    type Response,
} from "express";
import httpStatus from "http-status";
import z from "zod";
import config from "./app/config";
import { globalErrorHandler } from "./app/middleware/globalErrorHandler";
import { notFound } from "./app/middleware/notFound";
import { AuthRoutes } from "./app/module/auth/auth.route";
import { redisClient } from "./app/lib/redis";
import crypto from "crypto";

const app: Application = express();

app.use(
    cors({
        origin: config.frontend_url,
        credentials: true,
    }),
);

// Enable URL-encoded form data parsing
app.use(express.urlencoded({ extended: true }));

// Middleware to parse JSON bodies
app.use(express.json());
app.use(cookieParser());

app.use("/api/v1/auth", AuthRoutes);

app.get("/test", async (req: Request, res: Response, next: NextFunction) => {
    try {
		const otp = crypto.randomInt(100000, 1000000)

        // await redisClient.set(
        //     "forget-password-otp:patient01@email.com",
        //     "123456",
        //     {
        //         expiration: { type: "EX", value: 60 },
        //     },
        // );

        // console.log("result: ", result);

        res.status(httpStatus.OK).json({
            success: true,
            message: "WelCome to PH Healthcare System. You Are Using Zod.",
            data: otp,
        });
    } catch (error) {
        console.log(error);
        next(error);
    }
});

// Basic route
// biome-ignore lint/correctness/noUnusedFunctionParameters: explanation
app.get("/", async (req: Request, res: Response) => {
    res.status(httpStatus.OK).json({
        success: true,
        message: "Welcome to PH Healthcare System Backend",
    });
});

app.use(globalErrorHandler);
app.use(notFound);

export default app;
