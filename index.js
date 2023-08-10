function showParagraph(id) {
    let count = 1
    let paragraph = document.getElementById(`paragraph-${count}`)

    while (!!paragraph) {

        if (count === id) { 
            if (paragraph.className === 'showing') {
                paragraph.className = 'hidden'
                
            } else {
                paragraph.className = 'showing'
            }
        } else {
            paragraph.className = 'hidden'
        }

        count ++
        paragraph = document.getElementById(`paragraph-${count}`)
    }
}