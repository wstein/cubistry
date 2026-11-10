# SPDX-License-Identifier: AGPL-3.0-or-later
# Necessary theorem for a singleton artwork class present in every target.
function corner_anchor_contradiction(required,bodies,faces,peak,present,total)
    @assert bodies>0 && faces>0 && 0<=present<=total "valid finite body and target counts"
    required==bodies*faces && peak==1 && total>0 && present==total &&
        required-1>(bodies-1)*faces
end
