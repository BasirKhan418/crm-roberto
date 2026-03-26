import { NextResponse,NextRequest } from "next/server";
import { createCompanyProfileSchema } from "@/validators/cprofile.schema";
import checkMe from "@/utils/middlewares/checkMe";
import { createCompanyProfile, getCompanyProfileByUserId, updateCompanyProfileByUserId } from "@/db/repository/cprofile";
import getMe from "@/utils/middlewares/useMe";
export const POST = async (request: NextRequest) => {
    try{
        const  data = await request.json();
        
        const rs = await checkMe(true);
        console.log("checkMe result in cprofile route:", rs);
        if(!rs.success){
            return NextResponse.json({ message: "Unauthorized", success: false }, { status: 401 });
        }
        if(!rs.user){
            return NextResponse.json({ message: "User not found", success: false }, { status: 401 });
        }
        if(rs.user.isOnboardingComplete){
            return NextResponse.json({ message: "Onboarding already completed", success: false }, { status: 400 });
        }
        const validatedData = createCompanyProfileSchema.safeParse({ ...data, user: rs.user.id });

        if (!validatedData.success) {
            return NextResponse.json({ message: validatedData.error.issues[0].message, success: false });
        }
       
        const result = await createCompanyProfile(validatedData.data);
        //send an email to user here welcoming them and confirming company profile creation
        //todo
        return NextResponse.json(result);
    }
    catch(error){
        return NextResponse.json({ message: "Error creating company profile"+error, success: false });
    }
}

export const GET = async () => {
    try {
        const me = await getMe(true);
        if (!me.success || !me.user) {
            return NextResponse.json({ message: me.message || "Unauthorized", success: false }, { status: 401 });
        }

        const result = await getCompanyProfileByUserId(me.user.id);
        if (!result.success) {
            return NextResponse.json(result, { status: 404 });
        }

        return NextResponse.json(result);
    }
    catch (error) {
        return NextResponse.json({ message: "Error fetching company profile" + error, success: false }, { status: 500 });
    }
}

export const PATCH = async (request: NextRequest) => {
    try {
        const me = await getMe(true);
        if (!me.success || !me.user) {
            return NextResponse.json({ message: me.message || "Unauthorized", success: false }, { status: 401 });
        }

        const data = await request.json();
        const sanitizedData = { ...data };
        delete sanitizedData.user;

        const result = await updateCompanyProfileByUserId(me.user.id, sanitizedData);
        if (!result.success) {
            return NextResponse.json(result, { status: 404 });
        }

        return NextResponse.json(result);
    }
    catch (error) {
        return NextResponse.json({ message: "Error updating company profile" + error, success: false }, { status: 500 });
    }
}