import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import React from "react";

const HomePage = async () => {
  const { userId } = await auth();
  if (userId) {
    redirect("/projects");
  } else {
    redirect("/sign-in");
  }
};

export default HomePage;
