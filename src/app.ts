import cookieParser from "cookie-parser";
import cors from "cors";
import express, {
    NextFunction,
    type Application,
    type Request,
    type Response,
} from "express";
import httpStatus from "http-status";
import config from "./app/config";
import { globalErrorHandler } from "./app/middleware/globalErrorHandler";
import { notFound } from "./app/middleware/notFound";
import { AuthRoutes } from "./app/module/auth/auth.route";
import z, { email, success } from "zod";

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

app.post("/zod", async (req: Request, res: Response, next: NextFunction) => {
    try {
        const UserZodSchema = z.object({
            name: z.string().min(50),
            age: z.number().optional(),
            email: z.email(),
            isVarified: z.boolean().optional(),
            books: z.array(z.string()).optional(),
        });

        const payload = req.body;

        // const result = UserZodSchema.parse(payload);
        const result = UserZodSchema.safeParse(payload);

        if (!result.success) {
            console.log("result error: ", result.error);
        }

        console.log("result: ", result);

        res.status(httpStatus.OK).json({
            success: true,
            message: "WelCome to PH Healthcare System. You Are Using Zod.",
            data: result,
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
