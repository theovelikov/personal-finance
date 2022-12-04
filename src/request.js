const request = async ( url, params = {}, method = 'GET' ) => {
    let options = {
        method: method
    };
    if ( 'GET' === method ) {
        url += '?' + ( new URLSearchParams( params ) ).toString();
    } else {
        options.body = JSON.stringify( params );
    }

    const response = await fetch(url, options);
    return await response.json();
};
export const get = async ( url, params ) => await request( url, params, 'GET' );
export const post = async ( url, params ) => await request( url, params, 'POST' );