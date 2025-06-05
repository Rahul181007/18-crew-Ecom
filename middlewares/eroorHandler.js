function errorHandler(err,req,res,next){
    console.error(err.stack);
    console.error("error on route", req.method,req.originalUrl);
     const isAdmin=req.path.startsWith("/admin")
    if (err.source){
        console.error("Error Source",err.source)
    }


    const statusCode=err.statusCode||500;
    res.status(statusCode).render(isAdmin? "admin/admin-error":"users/page-404",{
        message:err.message||'Something went wrong',
        statusCode,
        activePage: '' 

    })
}
module.exports=errorHandler;